import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { userService } from '../services/supabaseService'

const AuthContext = createContext(null)

export function useAuth() {
    return useContext(AuthContext)
}

// Demo users for fallback when Supabase is not configured
const DEMO_USERS = {
    superadmin: { id: 'demo-1', nim_nip: 'superadmin', nama: 'Super Administrator', role: 'superadmin', prodi: null },
    admin: { id: 'demo-2', nim_nip: 'admin', nama: 'Admin Prodi TI', role: 'admin_prodi', prodi: { id: '1', nama: 'Teknologi Informasi' } },
    dosen: { id: 'demo-3', nim_nip: 'dosen', nama: 'Dr. Ahmad Suryadi', role: 'dosen', prodi: { id: '1', nama: 'Teknologi Informasi' } },
    mahasiswa: { id: 'demo-4', nim_nip: '2024001', nama: 'Budi Santoso', role: 'mahasiswa', prodi: { id: '1', nama: 'Teknologi Informasi' }, kelas: { id: '1', nama: 'TI-1A' } },
    pengawas: { id: 'demo-5', nim_nip: 'pengawas', nama: 'Pengawas Ujian', role: 'pengawas', prodi: null }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [isDemo, setIsDemo] = useState(false)

    // Check for existing session on mount
    useEffect(() => {
        checkSession()
    }, [])

    const checkSession = async () => {
        try {
            // Check localStorage for demo mode
            const savedUser = localStorage.getItem('cat_user')
            if (savedUser) {
                const parsed = JSON.parse(savedUser)
                setUser(parsed)
                setIsDemo(!isSupabaseConfigured())
            }
        } catch (e) {
            console.error('Failed to check session:', e)
        } finally {
            setLoading(false)
        }
    }

    // Login function - works with both Supabase and demo mode
    const login = async (nimNip, password, tahunAkademik) => {
        setLoading(true)
        setError(null)

        try {
            if (isSupabaseConfigured()) {
                // Try Supabase authentication
                const userData = await userService.getByNimNip(nimNip)

                if (!userData) {
                    throw new Error('User tidak ditemukan')
                }

                // For now, simple password check (in production, use proper auth)
                // TODO: Implement proper Supabase Auth
                if (password !== '123456') {
                    throw new Error('Password salah')
                }

                const userWithSession = {
                    ...userData,
                    tahunAkademik,
                    loginTime: new Date().toISOString()
                }

                setUser(userWithSession)
                setIsDemo(false)
                localStorage.setItem('cat_user', JSON.stringify(userWithSession))

                return { success: true, user: userWithSession }
            } else {
                // Demo mode fallback
                await new Promise(resolve => setTimeout(resolve, 200)) // Simulate network delay

                const demoUser = DEMO_USERS[nimNip.toLowerCase()]
                if (demoUser && password === '123456') {
                    const userWithSession = {
                        ...demoUser,
                        tahunAkademik,
                        loginTime: new Date().toISOString()
                    }
                    setUser(userWithSession)
                    setIsDemo(true)
                    localStorage.setItem('cat_user', JSON.stringify(userWithSession))
                    return { success: true, user: userWithSession }
                }

                throw new Error('NIM/NIP atau password salah')
            }
        } catch (e) {
            setError(e.message)
            return { success: false, error: e.message }
        } finally {
            setLoading(false)
        }
    }

    // Logout function
    const logout = async () => {
        setUser(null)
        setIsDemo(false)
        localStorage.removeItem('cat_user')
    }

    // Check if user has specific role
    const hasRole = (roles) => {
        if (!user) return false
        const roleArray = Array.isArray(roles) ? roles : [roles]
        return roleArray.includes(user.role)
    }

    // Get display role name
    const getRoleName = () => {
        if (!user) return ''
        const roleNames = {
            superadmin: 'Super Admin',
            admin_prodi: 'Admin Prodi',
            dosen: 'Dosen',
            mahasiswa: 'Mahasiswa',
            pengawas: 'Pengawas'
        }
        return roleNames[user.role] || user.role
    }

    const value = {
        user,
        loading,
        error,
        isDemo,
        login,
        logout,
        hasRole,
        getRoleName,
        isAuthenticated: !!user
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export default AuthContext
