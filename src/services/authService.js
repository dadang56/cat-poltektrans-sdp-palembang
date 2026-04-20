import { supabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * Authentication Service for CAT Poltektrans
 * Uses Supabase Auth with NIM/NIP as custom identifier
 */

// LocalStorage keys for session persistence (required for current device)
const USER_PROFILE_KEY = 'cat_user'
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

    try {
        // STRATEGY: Try Supabase Auth First
        // This avoids "NIM not found" errors caused by RLS blocking anon access to users table
        const email = `${nimNip.toLowerCase()}@cat.poltektrans.local`
        console.log('[AuthService] Attempting Supabase Auth for:', email)

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (authData?.session) {
            // AUTH SUCCESS!
            // Now we are authenticated, we can fetch our profile
            console.log('[AuthService] Supabase Auth success. Fetching profile...')

            const { data: userProfile, error: profileError } = await supabase
                .from('users')
                .select(`
                    *,
                    prodi:prodi_id(id, nama, kode),
                    kelas:kelas_id(id, nama)
                `)
                .eq('auth_id', authData.user.id)
                .single()

            if (profileError || !userProfile) {
                console.error('[AuthService] Profile not found for auth user:', profileError)
                await supabase.auth.signOut() // Rollback
                throw new Error('Profil pengguna tidak ditemukan.')
            }

            if (userProfile.status !== 'active') {
                await supabase.auth.signOut()
                throw new Error('Akun tidak aktif. Hubungi administrator.')
            }

            // Generate unique session token for concurrency control
            const sessionToken = generateSessionToken()

            // Update session token in database for this user
            await supabase
                .from('users')
                .update({ session_token: sessionToken })
                .eq('id', userProfile.id)

            // Store token in localStorage for validation
            localStorage.setItem(SESSION_TOKEN_KEY, sessionToken)
            localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(formatUserProfile(userProfile, authData.session)))

            return { data: formatUserProfile(userProfile, authData.session), error: null }

        } else {
            // AUTH FAILED or NO SESSION
            console.log('[AuthService] Supabase Auth failed/skipped. Checking Legacy DB Auth...')

            // Only now do we try to query the DB directly (as anon)
            // This might fail if RLS is strict, but that's expected for Legacy users in strict mode
            // We use 'maybeSingle' to avoid throwing immediately
            // Try lookup by nim_nip first
            let existingUser = null
            const { data: byNimNip, error: lookupError } = await supabase
                .from('users')
                .select(`
                    *,
                    prodi:prodi_id(id, nama, kode),
                    kelas:kelas_id(id, nama)
                `)
                .ilike('nim_nip', nimNip)
                .maybeSingle()

            if (lookupError && lookupError.code !== 'PGRST116') {
                console.error('[AuthService] Legacy lookup error:', lookupError)
                if (authError) throw new Error('Username atau Password salah')
                throw new Error('Gagal mengakses data pengguna')
            }

            existingUser = byNimNip

            // If not found by nim_nip, try by username
            if (!existingUser) {
                console.log('[AuthService] Not found by nim_nip, trying username...')
                const { data: byUsername, error: usernameError } = await supabase
                    .from('users')
                    .select(`
                        *,
                        prodi:prodi_id(id, nama, kode),
                        kelas:kelas_id(id, nama)
                    `)
                    .ilike('username', nimNip)
                    .maybeSingle()

                if (!usernameError || usernameError.code === 'PGRST116') {
                    existingUser = byUsername
                }
            }

            if (!existingUser) {
                throw new Error('NIM/NIP tidak ditemukan dalam sistem')
            }

            // If found, check password (Legacy Flow)
            if (existingUser.auth_id) {
                // It IS an auth user, but signInWithPassword failed above
                throw new Error('Password salah')
            }

            // Validating legacy password
            const storedPassword = existingUser.password || '123456'
            if (password === storedPassword) {
                if (existingUser.status !== 'active') {
                    throw new Error('Akun tidak aktif.')
                }

                const sessionToken = generateSessionToken()
                await supabase
                    .from('users')
                    .update({ session_token: sessionToken })
                    .eq('id', existingUser.id)

                const formattedUser = formatUserProfile(existingUser, null)
                localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(formattedUser))
                localStorage.setItem(SESSION_TOKEN_KEY, sessionToken)

                return { data: formattedUser, error: null }
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
    const localUser = localStorage.getItem(USER_PROFILE_KEY)
    if (localUser) {
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
    localStorage.removeItem(USER_PROFILE_KEY)
    localStorage.removeItem(SESSION_TOKEN_KEY)

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
    return await supabase.auth.getSession()
}

/**
 * Validate current session token against database
 * Returns false if session is invalid (logged in elsewhere)
 */
export async function validateSession() {
    const localUser = localStorage.getItem(USER_PROFILE_KEY)
    const localToken = localStorage.getItem(SESSION_TOKEN_KEY)

    if (!localUser || !localToken) {
        return { valid: false, reason: 'no_session' }
    }

    try {
        try {
            // Get user from localStorage first (works for both legacy and auth users since we store profile there)
            const localUser = localStorage.getItem(USER_PROFILE_KEY)
            // If not mapped there, check if we have a supabase session and partial profile

            let userId = null
            if (localUser) {
                const user = JSON.parse(localUser)
                userId = user.id
            } else {
                // Check Supabase session if strictly using that
                const { data: { session } } = await supabase.auth.getSession()
                if (session?.user) {
                    // We need to fetch the profile to get the integer ID, but let's see if we can optimize
                    // For now, let's assume the profile should be in localStorage after login
                    // If not, we might be in a reload state before profile fetch.
                    // It's safer to skip validation if we don't have the user ID yet.
                    return { valid: true }
                }
            }

            if (!userId) {
                return { valid: false, reason: 'no_session' }
            }

            // Check session token in database
            const { data, error } = await supabase
                .from('users')
                .select('session_token')
                .eq('id', userId)
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
    } catch (e) {
        console.error('[AuthService] Session validation outer error:', e)
        return { valid: true }
    }
}

/**
 * Get current user profile
 */
export async function getCurrentUser() {
    // Check localStorage for cached profile (works for both auth and legacy users)
    const localUser = localStorage.getItem(USER_PROFILE_KEY)
    if (localUser) {
        try {
            return JSON.parse(localUser)
        } catch (e) {
            localStorage.removeItem(USER_PROFILE_KEY)
        }
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
        prodi_id: profile.prodi_id, // snake_case alias for consistency
        prodi: profile.prodi,
        kelasId: profile.kelas_id,
        kelas_id: profile.kelas_id, // snake_case alias for consistency
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
