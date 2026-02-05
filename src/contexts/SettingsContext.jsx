import { createContext, useContext, useState, useEffect } from 'react'
import { appSettingsService, isSupabaseConfigured } from '../services/supabaseService'

// Generate current academic year
const generateCurrentTahunAkademik = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1 // 0-indexed
    // Ganjil: August-January, Genap: February-July
    if (month >= 8 || month <= 1) {
        return `${year}/${year + 1} Ganjil`
    } else {
        return `${year - 1}/${year} Genap`
    }
}

// Default settings
const DEFAULT_SETTINGS = {
    appName: 'POLTEKTRANS EXAM',
    appSubtitle: 'Sistem Ujian Online',
    logoUrl: '/logo.png',
    primaryColor: '#1e3a5f', // Navy blue
    secondaryColor: '#d4af37', // Gold
    institution: 'Politeknik Transportasi Sungai, Danau dan Penyeberangan Palembang',
    address: 'Jl. Residen Abdul Rozak, Palembang',
    phone: '(0711) 712345',
    email: 'info@poltektrans.ac.id',
    tahunAkademik: '2025/2026 Ganjil', // Default tahun akademik aktif
    // Kepala Bagian Administrasi Akademik dan Ketarunaan
    kepalaBaaName: '',
    kepalaBaaNip: ''
}

// Color presets
export const COLOR_PRESETS = [
    { name: 'Cyan (Default)', primary: '#0891b2', secondary: '#ca8a04' },
    { name: 'Blue', primary: '#2563eb', secondary: '#dc2626' },
    { name: 'Indigo', primary: '#4f46e5', secondary: '#ea580c' },
    { name: 'Purple', primary: '#7c3aed', secondary: '#059669' },
    { name: 'Emerald', primary: '#059669', secondary: '#7c3aed' },
    { name: 'Teal', primary: '#0d9488', secondary: '#b45309' },
    { name: 'Navy', primary: '#1e3a5f', secondary: '#d4af37' },
    { name: 'Maroon', primary: '#7f1d1d', secondary: '#1e3a5f' }
]

const SettingsContext = createContext(null)

export function useSettings() {
    return useContext(SettingsContext)
}

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS)
    const [isLoaded, setIsLoaded] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Load settings from Supabase or fallback to localStorage on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                if (isSupabaseConfigured()) {
                    // Load from Supabase
                    const supabaseSettings = await appSettingsService.get('app_config')
                    if (supabaseSettings) {
                        setSettings({ ...DEFAULT_SETTINGS, ...supabaseSettings })
                    }
                } else {
                    // Fallback to localStorage
                    const savedSettings = localStorage.getItem('cat_app_settings')
                    if (savedSettings) {
                        const parsed = JSON.parse(savedSettings)
                        setSettings({ ...DEFAULT_SETTINGS, ...parsed })
                    }
                }
            } catch (e) {
                console.error('Failed to load settings from Supabase:', e)
                // Fallback to localStorage on error
                const savedSettings = localStorage.getItem('cat_app_settings')
                if (savedSettings) {
                    try {
                        const parsed = JSON.parse(savedSettings)
                        setSettings({ ...DEFAULT_SETTINGS, ...parsed })
                    } catch (parseErr) {
                        console.error('Failed to parse localStorage settings:', parseErr)
                    }
                }
            }
            setIsLoaded(true)
        }

        loadSettings()
    }, [])

    // Apply CSS custom properties when settings change
    useEffect(() => {
        if (isLoaded) {
            document.documentElement.style.setProperty('--color-primary', settings.primaryColor)
            document.documentElement.style.setProperty('--color-secondary', settings.secondaryColor)

            // Generate lighter/darker variants
            const primaryHSL = hexToHSL(settings.primaryColor)
            if (primaryHSL) {
                document.documentElement.style.setProperty('--color-primary-light',
                    `hsl(${primaryHSL.h}, ${primaryHSL.s}%, ${Math.min(primaryHSL.l + 15, 95)}%)`)
                document.documentElement.style.setProperty('--color-primary-dark',
                    `hsl(${primaryHSL.h}, ${primaryHSL.s}%, ${Math.max(primaryHSL.l - 15, 5)}%)`)
            }
        }
    }, [settings, isLoaded])

    const updateSettings = async (newSettings) => {
        const updated = { ...settings, ...newSettings }
        setSettings(updated)

        // Always save to localStorage as backup
        localStorage.setItem('cat_app_settings', JSON.stringify(updated))

        // Try to save to Supabase if configured
        if (isSupabaseConfigured()) {
            setIsSaving(true)
            try {
                await appSettingsService.set('app_config', updated)
            } catch (e) {
                console.error('Failed to save settings to Supabase:', e)
            } finally {
                setIsSaving(false)
            }
        }
    }

    const resetSettings = async () => {
        setSettings(DEFAULT_SETTINGS)
        localStorage.removeItem('cat_app_settings')

        // Try to delete from Supabase if configured
        if (isSupabaseConfigured()) {
            try {
                await appSettingsService.delete('app_config')
            } catch (e) {
                console.error('Failed to delete settings from Supabase:', e)
            }
        }
    }

    const value = {
        settings,
        updateSettings,
        saveSettings: updateSettings, // Alias for updateSettings
        resetSettings,
        isLoaded,
        isSaving
    }

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    )
}

// Helper: Convert hex to HSL
function hexToHSL(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return null

    let r = parseInt(result[1], 16) / 255
    let g = parseInt(result[2], 16) / 255
    let b = parseInt(result[3], 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h, s, l = (max + min) / 2

    if (max === min) {
        h = s = 0
    } else {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
            case g: h = ((b - r) / d + 2) / 6; break
            case b: h = ((r - g) / d + 4) / 6; break
        }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export default SettingsContext
