import { supabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * Authentication Service for CAT Poltektrans
 * Uses Supabase Auth with NIM/NIP as custom identifier
 */

// LocalStorage keys for fallback/demo mode
const DEMO_USER_KEY = 'cat_user'
const USERS_KEY = 'cat_users_data'

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
            // Allow login with default password for migration period
            // In production, you should enforce password creation

            console.log('[AuthService] Legacy user login (no auth_id):', nimNip)

            // For manually created users, accept default password "123456"
            // TODO: In production, prompt user to create Supabase Auth account
            if (password === '123456') {
                const formattedUser = formatUserProfile(existingUser, null)

                // Store in localStorage as session (temporary until they get auth_id)
                localStorage.setItem(DEMO_USER_KEY, JSON.stringify(formattedUser))

                return {
                    data: formattedUser,
                    error: null,
                    requiresMigration: true  // Flag to prompt for password setup
                }
            } else {
                throw new Error('Password salah. Gunakan password default: 123456')
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
    if (!isSupabaseConfigured()) {
        localStorage.removeItem(DEMO_USER_KEY)
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
 * Get current user profile
 */
export async function getCurrentUser() {
    if (!isSupabaseConfigured()) {
        const demoUser = localStorage.getItem(DEMO_USER_KEY)
        return demoUser ? JSON.parse(demoUser) : null
    }

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
