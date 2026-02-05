import { useSettings } from '../contexts/SettingsContext'

/**
 * PrintHeader - Kop Surat component for print outputs
 * Usage: <PrintHeader title="DAFTAR HADIR UJIAN" />
 */
function PrintHeader({ title, subtitle, className = '' }) {
    const { settings } = useSettings()

    return (
        <div className={`print-header ${className}`} style={{
            textAlign: 'center',
            marginBottom: '24px',
            borderBottom: '3px double #333',
            paddingBottom: '16px'
        }}>
            {/* Logo and Institution */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                marginBottom: '8px'
            }}>
                {settings?.logoUrl && (
                    <img
                        src={settings.logoUrl}
                        alt="Logo"
                        style={{
                            height: '70px',
                            width: 'auto',
                            objectFit: 'contain'
                        }}
                    />
                )}
                <div>
                    <div style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        marginBottom: '2px',
                        letterSpacing: '0.5px'
                    }}>
                        KEMENTERIAN PERHUBUNGAN
                    </div>
                    <div style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        marginBottom: '2px',
                        letterSpacing: '0.5px'
                    }}>
                        BADAN PENGEMBANGAN SUMBER DAYA MANUSIA PERHUBUNGAN
                    </div>
                    <h1 style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        margin: '4px 0',
                        textTransform: 'uppercase'
                    }}>
                        {settings?.institution || 'POLITEKNIK TRANSPORTASI SUNGAI, DANAU DAN PENYEBERANGAN PALEMBANG'}
                    </h1>
                    <div style={{
                        fontSize: '10px',
                        color: '#444',
                        marginTop: '4px'
                    }}>
                        {settings?.address || 'Jl. Residen Abdul Rozak, Palembang'} |
                        Telp: {settings?.phone || '(0711) 712345'} |
                        Email: {settings?.email || 'info@poltektrans.ac.id'}
                    </div>
                </div>
            </div>

            {/* Document Title */}
            {title && (
                <h2 style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    marginTop: '16px',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>
                    {title}
                </h2>
            )}
            {subtitle && (
                <div style={{
                    fontSize: '12px',
                    color: '#555'
                }}>
                    {subtitle}
                </div>
            )}
        </div>
    )
}

/**
 * PrintFooter - Footer with signatures
 * Usage: <PrintFooter date="Palembang, 20 Januari 2025" leftSignature="Pengawas" rightSignature="Kepala Prodi" />
 */
function PrintFooter({ date, leftSignature, rightSignature, leftName, rightName, leftNIP, rightNIP }) {
    return (
        <div className="print-footer" style={{
            marginTop: '40px',
            fontSize: '12px'
        }}>
            {date && (
                <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                    {date}
                </div>
            )}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between'
            }}>
                {leftSignature && (
                    <div style={{ textAlign: 'center', width: '200px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '60px' }}>{leftSignature}</div>
                        <div style={{ fontWeight: 600, borderTop: '1px solid #333', paddingTop: '4px' }}>
                            {leftName || '................................'}
                        </div>
                        {leftNIP && <div style={{ fontSize: '10px' }}>NIP. {leftNIP}</div>}
                    </div>
                )}
                {rightSignature && (
                    <div style={{ textAlign: 'center', width: '200px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '60px' }}>{rightSignature}</div>
                        <div style={{ fontWeight: 600, borderTop: '1px solid #333', paddingTop: '4px' }}>
                            {rightName || '................................'}
                        </div>
                        {rightNIP && <div style={{ fontSize: '10px' }}>NIP. {rightNIP}</div>}
                    </div>
                )}
            </div>
        </div>
    )
}

export { PrintHeader, PrintFooter }
export default PrintHeader
