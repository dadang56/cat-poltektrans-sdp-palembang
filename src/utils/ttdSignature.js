// Electronic-signature (QR) helpers for printed documents.
//
// The QR is NOT a legally certified e-signature (not BSrE/PSrE). It is a
// verification QR generated inside Si-PANDU that encodes who signed, their
// NIP, the document and the date — so a printed Daftar Nilai / Berita Acara
// carries a scannable "ditandatangani secara elektronik" mark instead of a
// hand-signed line.
//
// One generator (data URL) is used for BOTH print mechanisms in the app:
//  - dosen prints build an HTML string (window.open + document.write)
//  - pengawas prints clone a React node (printRef + window.print)
// so an <img src="<dataUrl>"> works in either case.

import QRCode from 'qrcode'

const APP_NAME = 'Si-PANDU'
const INSTITUTION = 'Politeknik Transportasi SDP Palembang'

// Build the human-readable payload encoded inside the QR.
export function buildTtdPayload({ nama, nip, dokumen, tanggal }) {
    const tgl = tanggal || new Date().toLocaleDateString('id-ID')
    return [
        'TANDA TANGAN ELEKTRONIK',
        `${APP_NAME} - ${INSTITUTION}`,
        `Nama   : ${nama || '-'}`,
        nip ? `NIP    : ${nip}` : null,
        dokumen ? `Dokumen: ${dokumen}` : null,
        `Tanggal: ${tgl}`,
        'Diverifikasi melalui sistem Si-PANDU',
    ].filter(Boolean).join('\n')
}

// Returns a PNG data URL for the e-signature QR, or '' on any failure
// (so prints never break if the QR can't be drawn).
export async function generateTtdQrDataUrl({ nama, nip, dokumen, tanggal } = {}) {
    try {
        return await QRCode.toDataURL(buildTtdPayload({ nama, nip, dokumen, tanggal }), {
            margin: 1,
            width: 240,
            errorCorrectionLevel: 'M',
        })
    } catch {
        return ''
    }
}

// A dosen/pengawas uses the QR e-signature only when they turned it on AND
// have a NIP recorded.
export function hasTtdQr(user) {
    return Boolean(user?.ttd_qr_enabled && (user?.nip || user?.nim_nip))
}

// Keep a long "nama + gelar" on ONE line in printouts by shrinking the font
// for long strings (instead of letting it wrap to two lines).
export function nameFontSize(nama) {
    const len = (nama || '').length
    if (len > 46) return '7.5pt'
    if (len > 38) return '8.5pt'
    if (len > 30) return '9.5pt'
    return '11pt'
}

// Extra CSS appended to a print window's <style> block (string-based prints).
export function ttdPrintCss() {
    return `
        .ttd-qr { width: 70px; height: 70px; object-fit: contain; display: block; margin: 0 auto 2px; }
        .ttd-note { font-size: 7.5pt; font-style: italic; color: #333; margin: 0 0 2px; }
        .ttd-nama { white-space: nowrap; font-weight: bold; margin: 2px 0 0; }
        .ttd-nip { white-space: nowrap; margin: 1px 0 0; }
    `
}

// Inner HTML of a signature box for string-based prints (dosen Nilai pages).
// Renders the QR + name (1 line) + NIP when the QR is enabled, otherwise a
// blank space for a wet signature — same as before.
export function ttdSignatureInner({ tempat = 'Palembang', tanggal, peran, nama, nip, qrDataUrl }) {
    const tgl = tanggal || new Date().toLocaleDateString('id-ID')
    const font = nameFontSize(nama)
    const mark = qrDataUrl
        ? `<img class="ttd-qr" src="${qrDataUrl}" alt="QR Tanda Tangan Elektronik"/>
           <p class="ttd-note">Ditandatangani secara elektronik</p>`
        : `<div style="height:60px"></div>`
    return `
        <p>${tempat}, ${tgl}</p>
        <p>${peran}</p>
        <div class="signature-line">
            ${mark}
            <p class="ttd-nama" style="font-size:${font}">${nama || '_________________________'}</p>
            <p class="ttd-nip">NIP. ${nip || '-'}</p>
        </div>`
}
