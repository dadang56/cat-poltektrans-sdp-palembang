/* global process */
// Vercel serverless function: the Safe Exam Browser configuration file.
// Served at /sipandu.seb (see vercel.json) and opened with
//   sebs://<host>/sipandu.seb
//
// Why: SEB for iOS only locks the device (Assessment Mode / AAC: no app
// switching, no Home screen, no notifications) when its settings contain a
// quit password. Opening the exam page directly with sebs://<page> runs SEB
// with its default settings (no quit password), so students could still
// leave SEB and open other apps. This file gives SEB the locked settings.
// Checked against the SEB source (SafeExamBrowser/seb-mac):
//   - NSUserDefaults+SEBEncryptedUserDefaults.m: secureSession =
//     hashedQuitPassword is not empty
//   - SEBViewController.m conditionallyStartAssessmentMode: AAC/ASAM only
//     when secureSession and mobileEnableASAM
//   - SEBConfigFileManager.m: an unencrypted XML plist ("<?xm") is accepted
//
// The quit password is set by the admin in Pengaturan > Anti-Kecurangan;
// only its SHA-256 hash (what SEB expects) is stored in app_settings.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const xml = s => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// { hash } or { reason } ('no-env' | 'db-error' | 'no-password')
async function loadQuitHash() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return { reason: 'no-env' }
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.app_config&select=value`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    if (!r.ok) return { reason: 'db-error' }
    const rows = await r.json()
    const hash = rows?.[0]?.value?.sebQuitHash
    return typeof hash === 'string' && /^[0-9A-F]{64}$/i.test(hash)
        ? { hash: hash.toUpperCase() }
        : { reason: 'no-password' }
}

export function buildSebConfig({ origin, quitHash }) {
    const bool = v => (v ? '<true/>' : '<false/>')
    const settings = [
        ['sebConfigPurpose', '<integer>0</integer>'], // 0 = starting an exam
        ['startURL', `<string>${xml(origin + '/login')}</string>`],
        // A quit password turns on SEB's secure mode (and iOS Assessment Mode)
        ['hashedQuitPassword', `<string>${xml(quitHash)}</string>`],
        ['allowQuit', bool(true)],
        // Si-PANDU's "Keluar dari SEB" buttons open this URL to close SEB
        // without the password once the student is done
        ['quitURL', `<string>${xml(origin + '/seb-keluar')}</string>`],
        ['quitURLConfirm', bool(true)],
        // iOS: lock the device with Assessment Mode (AAC, works on students'
        // own iPhones/iPads); no classic Single App Mode / Guided Access
        ['mobileEnableASAM', bool(true)],
        ['mobileAllowSingleAppMode', bool(false)],
        ['mobileShowSettings', bool(false)],
        ['mobilePreventAutoLock', bool(true)],
        ['browserWindowAllowReload', bool(true)],
        ['showReloadButton', bool(true)],
        ['URLFilterEnable', bool(false)],
        ['examSessionClearCookiesOnStart', bool(true)],
        ['sendBrowserExamKey', bool(false)]
    ]
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${settings.map(([k, v]) => `\t<key>${k}</key>\n\t${v}`).join('\n')}
</dict>
</plist>
`
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')

    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
        res.status(400).send('Host tidak valid')
        return
    }
    const origin = `https://${host}`

    let loaded
    try {
        loaded = await loadQuitHash()
    } catch {
        loaded = { reason: 'db-error' }
    }
    const quitHash = loaded.hash
    // for checking the deployment without exposing anything
    res.setHeader('X-SEB-Config', quitHash ? 'ok' : loaded.reason)

    if (!quitHash) {
        // Not a config file: SEB shows this text as a page
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.status(503).send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font-family:system-ui;padding:2rem;line-height:1.5">
<h2>Konfigurasi SEB belum siap</h2>
<p>Admin belum mengatur <b>Password Keluar SEB</b> di Si-PANDU (Pengaturan &gt; Anti-Kecurangan). Hubungi admin atau pengawas.</p>
</body>`)
        return
    }

    res.setHeader('Content-Type', 'application/seb')
    res.setHeader('Content-Disposition', 'attachment; filename="sipandu.seb"')
    res.status(200).send(buildSebConfig({ origin, quitHash }))
}
