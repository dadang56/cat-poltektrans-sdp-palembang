import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { userService } from '../../services/supabaseService'
import { toast, errorMessage } from '../../components/Toast'
import { generateTtdQrDataUrl, nameFontSize } from '../../utils/ttdSignature'
import { QrCode, Save, ShieldCheck } from 'lucide-react'

// Account settings for dosen & pengawas: set the official NIP and turn on a
// QR electronic-signature that is stamped onto printed Daftar Nilai / Berita
// Acara documents.
export default function PengaturanAkun() {
    const { user, updateUser } = useAuth()

    const [nip, setNip] = useState('')
    const [qrEnabled, setQrEnabled] = useState(false)
    const [saving, setSaving] = useState(false)
    const [previewQr, setPreviewQr] = useState('')

    // Seed from the logged-in user. Fall back to the login nim_nip if no
    // dedicated NIP was recorded yet.
    useEffect(() => {
        if (!user) return
        setNip(user.nip || user.nim_nip || '')
        setQrEnabled(Boolean(user.ttd_qr_enabled))
    }, [user])

    // Live QR preview of what the printout will carry.
    useEffect(() => {
        let alive = true
        if (!qrEnabled || !nip.trim()) {
            setPreviewQr('')
            return
        }
        generateTtdQrDataUrl({
            nama: user?.nama || user?.name,
            nip: nip.trim(),
            dokumen: 'Contoh Dokumen Nilai',
        }).then((url) => {
            if (alive) setPreviewQr(url)
        })
        return () => {
            alive = false
        }
    }, [qrEnabled, nip, user])

    const handleSave = async () => {
        if (qrEnabled && !nip.trim()) {
            toast.error('Isi NIP terlebih dahulu untuk mengaktifkan tanda tangan elektronik.')
            return
        }
        setSaving(true)
        try {
            const patch = { nip: nip.trim(), ttd_qr_enabled: qrEnabled }
            await userService.update(user.id, patch)
            updateUser(patch)
            toast.success('Pengaturan tanda tangan tersimpan.')
        } catch (err) {
            toast.error(errorMessage(err))
        } finally {
            setSaving(false)
        }
    }

    const nama = user?.nama || user?.name || ''
    const peran = user?.role === 'pengawas' ? 'Pengawas Ujian' : 'Dosen Pengampu'

    return (
        <DashboardLayout>
            <div className="page-header">
                <h1 className="page-title">Pengaturan Akun</h1>
                <p className="page-subtitle">Tanda tangan elektronik (QR) &amp; NIP untuk cetak dokumen</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {/* Form */}
                <div className="card">
                    <div className="card-header">
                        <div className="flex items-center gap-3">
                            <ShieldCheck size={20} className="text-secondary" />
                            <h3 style={{ margin: 0 }}>Identitas Penanda Tangan</h3>
                        </div>
                    </div>
                    <div style={{ padding: '1.25rem' }}>
                        <div className="form-group">
                            <label className="form-label">Nama &amp; Gelar</label>
                            <input className="form-input" value={nama} disabled readOnly />
                            <span className="text-muted text-sm">Nama diubah oleh admin di Manajemen User.</span>
                        </div>

                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">NIP</label>
                            <input
                                className="form-input"
                                value={nip}
                                onChange={(e) => setNip(e.target.value)}
                                placeholder="Contoh: 198501012010011001"
                                inputMode="numeric"
                            />
                            <span className="text-muted text-sm">Tampil di bawah tanda tangan pada dokumen cetak.</span>
                        </div>

                        <div
                            className="form-group"
                            style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}
                        >
                            <input
                                id="ttd-qr-toggle"
                                type="checkbox"
                                checked={qrEnabled}
                                onChange={(e) => setQrEnabled(e.target.checked)}
                                style={{ width: 18, height: 18, marginTop: 2 }}
                            />
                            <label htmlFor="ttd-qr-toggle" style={{ cursor: 'pointer' }}>
                                <strong>Aktifkan Tanda Tangan Elektronik (QR)</strong>
                                <br />
                                <span className="text-muted text-sm">
                                    Saat dicentang, cetak nilai/berita acara menampilkan QR berisi nama, NIP, dokumen, dan
                                    tanggal. QR ini bukan sertifikat BSrE resmi, hanya verifikasi internal Si-PANDU.
                                </span>
                            </label>
                        </div>

                        <button className="btn btn-primary mt-3" onClick={handleSave} disabled={saving}>
                            <Save size={16} />
                            {saving ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </div>

                {/* Preview */}
                <div className="card">
                    <div className="card-header">
                        <div className="flex items-center gap-3">
                            <QrCode size={20} className="text-secondary" />
                            <h3 style={{ margin: 0 }}>Pratinjau Tanda Tangan</h3>
                        </div>
                    </div>
                    <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 2px' }}>Palembang, {new Date().toLocaleDateString('id-ID')}</p>
                        <p style={{ margin: '0 0 6px' }}>{peran}</p>
                        {qrEnabled && previewQr ? (
                            <>
                                <img
                                    src={previewQr}
                                    alt="QR Tanda Tangan Elektronik"
                                    style={{ width: 90, height: 90, objectFit: 'contain', margin: '0 auto 2px' }}
                                />
                                <p style={{ margin: 0, fontSize: '0.72rem', fontStyle: 'italic', color: '#444' }}>
                                    Ditandatangani secara elektronik
                                </p>
                            </>
                        ) : (
                            <div style={{ height: 60 }} />
                        )}
                        <p style={{ margin: '4px 0 0', fontWeight: 700, whiteSpace: 'nowrap', fontSize: nameFontSize(nama) }}>
                            {nama || '_________________________'}
                        </p>
                        <p style={{ margin: '1px 0 0', whiteSpace: 'nowrap' }}>NIP. {nip || '-'}</p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
