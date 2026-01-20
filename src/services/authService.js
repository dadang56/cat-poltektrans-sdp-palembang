import { supabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * Authentication Service for CAT Poltektrans
 * Uses Supabase Auth with NIM/NIP as custom identifier
 */

// LocalStorage keys for fallback/demo mode
const DEMO_USER_KEY = 'cat_user'
const USERS_KEY = 'cat_users_data'
const SESSION_TOKEN_KEY = 'cat_session_token'

/**
 * Generate unique session token
 */
function generateSessionToken() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Sign in with NIM/NIP and password
 * Flow:
 * 1. First check if user exists in public.users table
 * 2. If user has auth_id -> authenticate via Supabase Auth
 * 3. If user has NO auth_id -> allow temporary login (legacy/manual users)
 */
export async function signInWithNimNip(nimNip, password) {
    if (!isSupabaseConfigured()) {
        // Fallback to demo mode
        return signInDemo(nimNip, password)
    }

    try {
        // STEP 1: First check if user exists in public.users (uses anon key, bypasses RLS for select)
        const { data: existingUser, error: lookupError } = await supabase
            .from('users')
            .select(`
                *,
                prodi:prodi_id(id, nama, kode),
                kelas:kelas_id(id, nama)
            `)
            .ilike('nim_nip', nimNip)  // Case-insensitive match
            .single()

        if (lookupError || !existingUser) {
            // User not found in database at all
            console.log('[AuthService] User not found in database:', nimNip)
            throw new Error('NIM/NIP tidak ditemukan dalam sistem')
        }

        // Check user status
        if (existingUser.status !== 'active') {
            throw new Error('Akun tidak aktif. Hubungi administrator.')
        }

        // STEP 2: Check if user has auth_id (linked to Supabase Auth)
        if (existingUser.auth_id) {
            // User has Supabase Auth account - authenticate properly
            const email = `${nimNip.toLowerCase()}@cat.poltektrans.local`

            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (authError) {
                console.log('[AuthService] Supabase Auth failed:', authError.message)
                throw new Error('Password salah')
            }

            // Success with Supabase Auth
            return { data: formatUserProfile(existingUser, authData.session), error: null }
        } else {
            // STEP 3: User exists but NO auth_id (manually created user)
            // Validate password from database

            console.log('[AuthService] Database user login (no auth_id):', nimNip)

            // Check password from database (or use 123456 as default if not set)
            const storedPassword = existingUser.password || '123456'

            if (password === storedPassword) {
                // Generate unique session token
                const sessionToken = generateSessionToken()

                // Update session token in database
                await supabase
                    .from('users')
                    .update({ session_token: sessionToken })
                    .eq('id', existingUser.id)

                const formattedUser = formatUserProfile(existingUser, null)

                // Store in localStorage as session
                localStorage.setItem(DEMO_USER_KEY, JSON.stringify(formattedUser))
                localStorage.setItem(SESSION_TOKEN_KEY, sessionToken)

                return {
                    data: formattedUser,
                    error: null
                }
            } else {
                throw new Error('Password salah')
            }
        }
    } catch (error) {
        console.error('[AuthService] Sign in error:', error)
        return { data: null, error }
    }
}

/**
 * Sign up a new user (admin function)
 */
export async function signUpUser(nimNip, password, userData) {
    if (!isSupabaseConfigured()) {
        return signUpDemo(nimNip, password, userData)
    }

    try {
        const email = `${nimNip.toLowerCase()}@cat.poltektrans.local`

        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        })

        if (authError) throw authError

        // Create user profile
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .insert({
                ...userData,
                nim_nip: nimNip,
                auth_id: authData.user.id
            })
            .select()
            .single()

        if (profileError) throw profileError

        return { data: profile, error: null }
    } catch (error) {
        console.error('[AuthService] Sign up error:', error)
        return { data: null, error }
    }
}

/**
 * Sign out current user
 */
export async function signOut() {
    // Clear session token from database
    const localUser = localStorage.getItem(DEMO_USER_KEY)
    if (localUser && isSupabaseConfigured()) {
        try {
            const user = JSON.parse(localUser)
            if (user?.id) {
                await supabase
                    .from('users')
                    .update({ session_token: null })
                    .eq('id', user.id)
            }
        } catch (e) {
            console.error('[AuthService] Error clearing session token:', e)
        }
    }

    // Clear localStorage
    localStorage.removeItem(DEMO_USER_KEY)
    localStorage.removeItem(SESSION_TOKEN_KEY)

    if (!isSupabaseConfigured()) {
        return { error: null }
    }

    try {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        return { error: null }
    } catch (error) {
        console.error('[AuthService] Sign out error:', error)
        return { error }
    }
}

/**
 * Get current session
 */
export async function getSession() {
    if (!isSupabaseConfigured()) {
        const demoUser = localStorage.getItem(DEMO_USER_KEY)
        return {
            data: { session: demoUser ? { user: JSON.parse(demoUser) } : null },
            error: null
        }
    }

    return await supabase.auth.getSession()
}

/**
 * Validate current session token against database
 * Returns false if session is invalid (logged in elsewhere)
 */
export async function validateSession() {
    if (!isSupabaseConfigured()) {
        return { valid: true }
    }

    const localUser = localStorage.getItem(DEMO_USER_KEY)
    const localToken = localStorage.getItem(SESSION_TOKEN_KEY)

    if (!localUser || !localToken) {
        return { valid: false, reason: 'no_session' }
    }

    try {
        const user = JSON.parse(localUser)
        if (!user?.id) {
            return { valid: false, reason: 'invalid_user' }
        }

        // Check session token in database
        const { data, error } = await supabase
            .from('users')
            .select('session_token')
            .eq('id', user.id)
            .single()

        if (error) {
            console.error('[AuthService] Session validation error:', error)
            return { valid: true } // Don't logout on network errors
        }

        // If database token doesn't match local token, session is invalid
        if (data.session_token !== localToken) {
            console.log('[AuthService] Session invalidated - logged in elsewhere')
            return { valid: false, reason: 'session_invalidated' }
        }

        return { valid: true }
    } catch (e) {
        console.error('[AuthService] Session validation error:', e)
        return { valid: true } // Don't logout on errors
    }
}

/**
 * Get current user profile
 */
export async function getCurrentUser() {
    // First, always check localStorage for database-only auth session
    const localUser = localStorage.getItem(DEMO_USER_KEY)
    if (localUser) {
        try {
            return JSON.parse(localUser)
        } catch (e) {
            localStorage.removeItem(DEMO_USER_KEY)
        }
    }

    // If no local session and Supabase not configured, return null
    if (!isSupabaseConfigured()) {
        return null
    }

    // Check Supabase Auth session (for future OAuth users)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null

    const { data: profile } = await supabase
        .from('users')
        .select(`
            *,
            prodi:prodi_id(id, nama, kode),
            kelas:kelas_id(id, nama)
        `)
        .eq('auth_id', session.user.id)
        .single()

    return profile ? formatUserProfile(profile, session) : null
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(callback) {
    if (!isSupabaseConfigured()) {
        // In demo mode, just call with current state
        const demoUser = localStorage.getItem(DEMO_USER_KEY)
        callback('SIGNED_IN', demoUser ? { user: JSON.parse(demoUser) } : null)
        return { data: { subscription: { unsubscribe: () => { } } } }
    }

    return supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            const user = await getCurrentUser()
            callback(event, { ...session, profile: user })
        } else {
            callback(event, session)
        }
    })
}

/**
 * Update user password
 */
export async function updatePassword(newPassword) {
    if (!isSupabaseConfigured()) {
        return { error: new Error('Not supported in demo mode') }
    }

    return await supabase.auth.updateUser({ password: newPassword })
}

// ============================================
// Helper Functions
// ============================================

function formatUserProfile(profile, session) {
    // Parse JSON fields for dosen (could be string or array)
    const parseJsonField = (field) => {
        if (!field) return []
        if (typeof field === 'string') {
            try {
                return JSON.parse(field)
            } catch {
                return []
            }
        }
        return Array.isArray(field) ? field : []
    }

    return {
        id: profile.id,
        authId: session?.user?.id,
        nimNip: profile.nim_nip,
        nim: profile.nim_nip, // alias for compatibility
        nama: profile.nama,
        name: profile.nama, // alias for compatibility
        email: profile.email,
        role: profile.role,
        status: profile.status,
        prodiId: profile.prodi_id,
        prodi: profile.prodi,
        kelasId: profile.kelas_id,
        kelas: profile.kelas,
        // Dosen-specific fields
        matkulIds: parseJsonField(profile.matkul_ids),
        kelasIds: parseJsonField(profile.kelas_ids),
        prodiIds: parseJsonField(profile.prodi_ids),
        matkul_ids: profile.matkul_ids, // Keep original for compatibility
        session: session
    }
}

async function checkLegacyUser(nimNip, password) {
    // Check if user exists in database without auth_id
    const { data: user } = await supabase
        .from('users')
        .select(`
            *,
            prodi:prodi_id(id, nama, kode),
            kelas:kelas_id(id, nama)
        `)
        .eq('nim_nip', nimNip)
        .is('auth_id', null)
        .single()

    if (user) {
        // For now, allow login with just nim_nip match (migration period)
        // TODO: Implement proper password verification
        return formatUserProfile(user, null)
    }
    return null
}

// ============================================
// Demo Mode Functions (when Supabase not configured)
// ============================================

function signInDemo(nimNip, password) {
    const usersData = localStorage.getItem(USERS_KEY)
    const users = usersData ? JSON.parse(usersData) : []

    // Find user by nim_nip (no more demo accounts)
    const user = users.find(u => u.nim_nip === nimNip || u.nimNip === nimNip)

    if (!user) {
        return { data: null, error: new Error('NIM/NIP tidak ditemukan') }
    }

    if (user.status !== 'active') {
        return { data: null, error: new Error('Akun tidak aktif') }
    }

    const formattedUser = {
        id: user.id || nimNip,
        nimNip: user.nim_nip || user.nimNip,
        nim: user.nim_nip || user.nimNip,
        nama: user.nama,
        name: user.nama,
        email: user.email,
        role: user.role,
        status: user.status,
        prodiId: user.prodi_id || user.prodiId,
        kelasId: user.kelas_id || user.kelasId
    }

    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(formattedUser))
    return { data: formattedUser, error: null }
}

function signUpDemo(nimNip, password, userData) {
    const usersData = localStorage.getItem(USERS_KEY)
    const users = usersData ? JSON.parse(usersData) : []

    // Check if user already exists
    if (users.find(u => u.nim_nip === nimNip)) {
        return { data: null, error: new Error('NIM/NIP sudah terdaftar') }
    }

    const newUser = {
        id: Date.now(),
        nim_nip: nimNip,
        ...userData,
        status: 'active',
        created_at: new Date().toISOString()
    }

    users.push(newUser)
    localStorage.setItem(USERS_KEY, JSON.stringify(users))

    return { data: newUser, error: null }
}

// Export for use in components
export default {
    signInWithNimNip,
    signUpUser,
    signOut,
    getSession,
    getCurrentUser,
    onAuthStateChange,
    updatePassword,
    isSupabaseConfigured
}
