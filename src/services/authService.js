import { supabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * Authentication Service for CAT Poltektrans
 * Optimized: DB-first login to reduce Supabase Auth load
 */

// LocalStorage keys for session persistence
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
 * OPTIMIZED Flow:
 * 1. First lookup user in DB by nim_nip (1 lightweight query)
 * 2. If user has auth_id -> authenticate via Supabase Auth
 * 3. If user has NO auth_id -> legacy password check (no Supabase Auth call)
 * This avoids wasting a Supabase Auth call for every legacy user login.
 */
export async function signInWithNimNip(nimNip, password) {
    try {
        // STEP 1: Lookup user in DB first (lightweight - select only needed columns)
        let existingUser = null
        const { data: byNimNip, error: lookupError } = await supabase
            .from('users')
            .select(`
                id, nim_nip, nama, email, role, status, password, auth_id,
                prodi_id, kelas_id, matkul_ids, kelas_ids, prodi_ids,
                prodi:prodi_id(id, nama, kode),
                kelas:kelas_id(id, nama)
            `)
            .ilike('nim_nip', nimNip)
            .maybeSingle()

        if (!lookupError || lookupError.code === 'PGRST116') {
            existingUser = byNimNip
        }

        // If not found by nim_nip, try by username
        if (!existingUser) {
            const { data: byUsername, error: usernameError } = await supabase
                .from('users')
                .select(`
                    id, nim_nip, nama, email, role, status, password, auth_id,
                    prodi_id, kelas_id, matkul_ids, kelas_ids, prodi_ids,
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

        if (existingUser.status !== 'active') {
            throw new Error('Akun tidak aktif. Hubungi administrator.')
        }

        // STEP 2: Route based on whether user has Supabase Auth
        if (existingUser.auth_id) {
            // === SUPABASE AUTH USER ===
            const email = `${nimNip.toLowerCase()}@cat.poltektrans.local`
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (authError || !authData?.session) {
                throw new Error('Password salah')
            }

            // Generate session token
            const sessionToken = generateSessionToken()
            await supabase
                .from('users')
                .update({ session_token: sessionToken })
                .eq('id', existingUser.id)

            localStorage.setItem(SESSION_TOKEN_KEY, sessionToken)
            const formattedUser = formatUserProfile(existingUser, authData.session)
            localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(formattedUser))

            return { data: formattedUser, error: null }

        } else {
            // === LEGACY USER (no Supabase Auth call needed!) ===
            const storedPassword = existingUser.password || '123456'
            if (password !== storedPassword) {
                throw new Error('Password salah')
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
 * Validate current session - check if session token still matches DB
 * OPTIMIZED: Uses lightweight select (only session_token column)
 */
export async function validateSession() {
    const localUser = localStorage.getItem(USER_PROFILE_KEY)
    const localToken = localStorage.getItem(SESSION_TOKEN_KEY)

    if (!localUser || !localToken) {
        return { valid: false, reason: 'no_session' }
    }

    try {
        let userId = null
        if (localUser) {
            const user = JSON.parse(localUser)
            userId = user.id
        }

        if (!userId) {
            return { valid: false, reason: 'no_session' }
        }

        // Lightweight query - only fetch session_token column
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
}

/**
 * Get current user profile - OPTIMIZED: uses localStorage cache first
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

    // Only check Supabase Auth session if no cached profile
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return null

        const { data: profile } = await supabase
            .from('users')
            .select(`
                id, nim_nip, nama, email, role, status, auth_id,
                prodi_id, kelas_id, matkul_ids, kelas_ids, prodi_ids,
                prodi:prodi_id(id, nama, kode),
                kelas:kelas_id(id, nama)
            `)
            .eq('auth_id', session.user.id)
            .single()

        if (profile) {
            const formattedUser = formatUserProfile(profile, session)
            // Cache the profile for future calls
            localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(formattedUser))
            return formattedUser
        }
    } catch (e) {
        console.error('[AuthService] getCurrentUser error:', e)
    }

    return null
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
            id, nim_nip, nama, email, role, status, auth_id,
            prodi_id, kelas_id, matkul_ids, kelas_ids, prodi_ids,
            prodi:prodi_id(id, nama, kode),
            kelas:kelas_id(id, nama)
        `)
        .eq('nim_nip', nimNip)
        .is('auth_id', null)
        .single()

    if (user) {
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
    validateSession,
    isSupabaseConfigured
}
