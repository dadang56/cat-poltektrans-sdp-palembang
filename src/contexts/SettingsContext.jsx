import { createContext, useContext, useState, useEffect } from 'react'

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
    email: 'info@poltektrans.ac.id'
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

    // Load settings from localStorage on mount
    useEffect(() => {
        const savedSettings = localStorage.getItem('cat_app_settings')
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings)
                setSettings({ ...DEFAULT_SETTINGS, ...parsed })
            } catch (e) {
                console.error('Failed to parse settings:', e)
            }
        }
        setIsLoaded(true)
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

    const updateSettings = (newSettings) => {
        const updated = { ...settings, ...newSettings }
        setSettings(updated)
        localStorage.setItem('cat_app_settings', JSON.stringify(updated))
    }

    const resetSettings = () => {
        setSettings(DEFAULT_SETTINGS)
        localStorage.removeItem('cat_app_settings')
    }

    const value = {
        settings,
        updateSettings,
        saveSettings: updateSettings, // Alias for updateSettings
        resetSettings,
        isLoaded
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
