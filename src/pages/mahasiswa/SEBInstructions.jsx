import { useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import {
    Download,
    Monitor,
    Smartphone,
    Tablet,
    Apple,
    CheckCircle,
    AlertTriangle,
    ExternalLink,
    QrCode,
    Shield,
    HelpCircle,
    ChevronDown,
    ChevronUp
} from 'lucide-react'

const SEB_DOWNLOADS = {
    windows: {
        name: 'Windows',
        icon: Monitor,
        url: 'https://safeexambrowser.org/download_en.html',
        version: '3.7.0+',
        requirements: 'Windows 10/11',
        official: true
    },
    macos: {
        name: 'macOS',
        icon: Monitor,
        url: 'https://safeexambrowser.org/download_en.html',
        version: '3.3+',
        requirements: 'macOS 11+',
        official: true
    },
    ios: {
        name: 'iOS (iPhone/iPad)',
        icon: Tablet,
        url: 'https://apps.apple.com/app/safe-exam-browser/id1089988090',
        version: '3.4+',
        requirements: 'iOS 14+',
        official: true
    },
    android: {
        name: 'Android',
        icon: Smartphone,
        url: 'https://play.google.com/store/apps/details?id=org.nickvision.examprep',
        version: 'Latest',
        requirements: 'Android 8+',
        official: false,
        note: 'Gunakan "Exam Browser" dari Play Store (third-party)'
    }
}

const FAQ_ITEMS = [
    {
        question: 'Apa itu Safe Exam Browser?',
        answer: 'Safe Exam Browser (SEB) adalah browser khusus yang mengunci perangkat Anda selama ujian berlangsung. SEB mencegah akses ke aplikasi lain, website lain, copy-paste, dan fitur lain yang bisa digunakan untuk kecurangan.'
    },
    {
        question: 'Apakah SEB wajib digunakan?',
        answer: 'Tergantung pengaturan ujian dari dosen/admin. Beberapa ujian mewajibkan SEB, sedangkan yang lain mengizinkan browser biasa dengan monitoring peringatan.'
    },
    {
        question: 'Bagaimana cara menginstall SEB?',
        answer: 'Pilih platform Anda di atas, klik tombol Download, dan ikuti instruksi instalasi. Setelah terinstall, Anda bisa membuka URL ujian langsung dari SEB.'
    },
    {
        question: 'SEB tidak tersedia untuk Android?',
        answer: 'Benar, SEB resmi tidak tersedia untuk Android. Sebagai alternatif, gunakan aplikasi "Exam Browser" dari Play Store yang menyediakan fungsi serupa.'
    },
    {
        question: 'Apa yang terjadi jika saya keluar dari SEB saat ujian?',
        answer: 'Sistem akan mencatat pelanggaran dan memberikan peringatan. Jika peringatan mencapai batas maksimum, ujian akan otomatis diakhiri dan dilaporkan ke pengawas.'
    },
    {
        question: 'Bagaimana jika SEB crash atau error?',
        answer: 'Segera hubungi pengawas ujian. Jawaban Anda tetap tersimpan di server, jadi Anda bisa melanjutkan ujian setelah masalah teratasi.'
    }
]

function SEBInstructions() {
    const [expandedFaq, setExpandedFaq] = useState(null)

    const toggleFaq = (index) => {
        setExpandedFaq(expandedFaq === index ? null : index)
    }

    return (
        <DashboardLayout>
            <div className="seb-instructions-page animate-fadeIn">
                <div className="page-header">
                    <h1 className="page-title">
                        <Shield size={32} className="title-icon" />
                        Safe Exam Browser
                    </h1>
                    <p className="page-subtitle">
                        Panduan instalasi dan penggunaan Safe Exam Browser untuk ujian online
                    </p>
                </div>

                {/* Warning Banner */}
                <div className="seb-warning-banner">
                    <AlertTriangle size={24} />
                    <div>
                        <strong>Penting!</strong>
                        <p>Pastikan Anda sudah menginstall Safe Exam Browser sebelum jadwal ujian dimulai. Ujian tertentu mungkin tidak bisa diakses tanpa SEB.</p>
                    </div>
                </div>

                {/* Download Section */}
                <section className="download-section">
                    <h2 className="section-title">Download Safe Exam Browser</h2>
                    <p className="section-desc">Pilih platform Anda untuk mengunduh SEB:</p>

                    <div className="download-grid">
                        {Object.entries(SEB_DOWNLOADS).map(([key, platform]) => (
                            <div key={key} className={`download-card ${!platform.official ? 'unofficial' : ''}`}>
                                <div className="download-header">
                                    <platform.icon size={32} className="platform-icon" />
                                    <div>
                                        <h3>{platform.name}</h3>
                                        {!platform.official && (
                                            <span className="badge badge-warning">Third-Party</span>
                                        )}
                                    </div>
                                </div>
                                <div className="download-info">
                                    <p><strong>Versi:</strong> {platform.version}</p>
                                    <p><strong>Syarat:</strong> {platform.requirements}</p>
                                    {platform.note && (
                                        <p className="platform-note">
                                            <AlertTriangle size={14} />
                                            {platform.note}
                                        </p>
                                    )}
                                </div>
                                <a
                                    href={platform.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-primary download-btn"
                                >
                                    <Download size={18} />
                                    Download
                                    <ExternalLink size={14} />
                                </a>
                            </div>
                        ))}
                    </div>
                </section>

                {/* How to Use Section */}
                <section className="howto-section">
                    <h2 className="section-title">Cara Menggunakan</h2>

                    <div className="steps-container">
                        <div className="step-card">
                            <div className="step-number">1</div>
                            <div className="step-content">
                                <h3>Install SEB</h3>
                                <p>Download dan install Safe Exam Browser sesuai platform Anda. Ikuti petunjuk instalasi yang muncul.</p>
                            </div>
                        </div>

                        <div className="step-card">
                            <div className="step-number">2</div>
                            <div className="step-content">
                                <h3>Buka SEB</h3>
                                <p>Jalankan aplikasi Safe Exam Browser. Pada tampilan awal, masukkan URL ujian atau scan QR code yang diberikan.</p>
                            </div>
                        </div>

                        <div className="step-card">
                            <div className="step-number">3</div>
                            <div className="step-content">
                                <h3>Login</h3>
                                <p>Masuk dengan akun mahasiswa Anda (NIM dan password). Pastikan menggunakan akun yang terdaftar.</p>
                            </div>
                        </div>

                        <div className="step-card">
                            <div className="step-number">4</div>
                            <div className="step-content">
                                <h3>Mulai Ujian</h3>
                                <p>Pilih ujian yang akan dikerjakan dan klik "Mulai Ujian". SEB akan mengunci perangkat Anda selama ujian berlangsung.</p>
                            </div>
                        </div>

                        <div className="step-card">
                            <div className="step-number">5</div>
                            <div className="step-content">
                                <h3>Submit & Keluar</h3>
                                <p>Setelah selesai, klik "Submit Ujian". SEB akan otomatis menutup mode terkunci setelah ujian berakhir.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* URL Ujian */}
                <section className="exam-url-section">
                    <h2 className="section-title">URL Ujian</h2>
                    <div className="url-card">
                        <div className="url-display">
                            <code>{window.location.origin}</code>
                            <button
                                className="btn btn-outline btn-sm"
                                onClick={() => navigator.clipboard.writeText(window.location.origin)}
                            >
                                Copy
                            </button>
                        </div>
                        <p className="url-note">
                            Masukkan URL ini di Safe Exam Browser untuk mengakses sistem ujian.
                        </p>
                    </div>
                </section>

                {/* Features */}
                <section className="features-section">
                    <h2 className="section-title">Fitur Keamanan</h2>
                    <div className="features-grid">
                        <div className="feature-item">
                            <CheckCircle size={24} className="feature-icon success" />
                            <span>Blokir aplikasi lain</span>
                        </div>
                        <div className="feature-item">
                            <CheckCircle size={24} className="feature-icon success" />
                            <span>Blokir copy/paste</span>
                        </div>
                        <div className="feature-item">
                            <CheckCircle size={24} className="feature-icon success" />
                            <span>Blokir screenshot</span>
                        </div>
                        <div className="feature-item">
                            <CheckCircle size={24} className="feature-icon success" />
                            <span>Blokir tab baru</span>
                        </div>
                        <div className="feature-item">
                            <CheckCircle size={24} className="feature-icon success" />
                            <span>Deteksi keluar jendela</span>
                        </div>
                        <div className="feature-item">
                            <CheckCircle size={24} className="feature-icon success" />
                            <span>Mode fullscreen</span>
                        </div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section className="faq-section">
                    <h2 className="section-title">
                        <HelpCircle size={24} />
                        Pertanyaan Umum
                    </h2>
                    <div className="faq-list">
                        {FAQ_ITEMS.map((item, index) => (
                            <div key={index} className={`faq-item ${expandedFaq === index ? 'expanded' : ''}`}>
                                <button
                                    className="faq-question"
                                    onClick={() => toggleFaq(index)}
                                >
                                    <span>{item.question}</span>
                                    {expandedFaq === index ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </button>
                                {expandedFaq === index && (
                                    <div className="faq-answer">
                                        <p>{item.answer}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <style>{`
        .seb-instructions-page {
          max-width: 900px;
          margin: 0 auto;
        }

        .title-icon {
          color: var(--primary-500);
        }

        .seb-warning-banner {
          display: flex;
          gap: var(--space-4);
          padding: var(--space-4);
          background: var(--warning-50);
          border: 1px solid var(--warning-500);
          border-radius: var(--radius-lg);
          margin-bottom: var(--space-8);
          color: var(--warning-600);
        }

        .seb-warning-banner svg {
          flex-shrink: 0;
        }

        .seb-warning-banner p {
          margin: var(--space-1) 0 0;
          font-size: var(--font-size-sm);
        }

        [data-theme="dark"] .seb-warning-banner {
          background: rgba(245, 158, 11, 0.1);
        }

        .section-title {
          font-size: var(--font-size-xl);
          font-weight: var(--font-bold);
          color: var(--text-primary);
          margin-bottom: var(--space-2);
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .section-desc {
          color: var(--text-secondary);
          margin-bottom: var(--space-6);
        }

        .download-section,
        .howto-section,
        .exam-url-section,
        .features-section,
        .faq-section {
          margin-bottom: var(--space-10);
        }

        .download-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: var(--space-4);
        }

        .download-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .download-card.unofficial {
          border-color: var(--warning-500);
        }

        .download-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .platform-icon {
          color: var(--primary-500);
        }

        .download-header h3 {
          font-size: var(--font-size-base);
          font-weight: var(--font-semibold);
        }

        .download-info {
          flex: 1;
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
        }

        .download-info p {
          margin: var(--space-1) 0;
        }

        .platform-note {
          display: flex;
          align-items: flex-start;
          gap: var(--space-1);
          color: var(--warning-600);
          font-size: var(--font-size-xs);
          margin-top: var(--space-2) !important;
        }

        .download-btn {
          width: 100%;
          justify-content: center;
        }

        .steps-container {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .step-card {
          display: flex;
          gap: var(--space-4);
          padding: var(--space-4);
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
        }

        .step-number {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, var(--primary-500), var(--accent-500));
          color: white;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: var(--font-bold);
          flex-shrink: 0;
        }

        .step-content h3 {
          font-size: var(--font-size-base);
          font-weight: var(--font-semibold);
          margin-bottom: var(--space-1);
        }

        .step-content p {
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
        }

        .url-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
        }

        .url-display {
          display: flex;
          gap: var(--space-3);
          align-items: center;
          margin-bottom: var(--space-3);
        }

        .url-display code {
          flex: 1;
          padding: var(--space-3) var(--space-4);
          background: var(--bg-tertiary);
          border-radius: var(--radius-md);
          font-family: monospace;
          font-size: var(--font-size-sm);
          overflow-x: auto;
        }

        .url-note {
          font-size: var(--font-size-sm);
          color: var(--text-muted);
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--space-3);
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3);
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          font-size: var(--font-size-sm);
        }

        .feature-icon.success {
          color: var(--success-500);
        }

        .faq-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .faq-item {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .faq-question {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4);
          background: none;
          border: none;
          font-size: var(--font-size-base);
          font-weight: var(--font-medium);
          text-align: left;
          color: var(--text-primary);
          cursor: pointer;
          transition: background var(--transition-fast);
        }

        .faq-question:hover {
          background: var(--bg-tertiary);
        }

        .faq-answer {
          padding: 0 var(--space-4) var(--space-4);
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
          line-height: 1.6;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .download-grid {
            grid-template-columns: 1fr;
          }

          .features-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .step-card {
            flex-direction: column;
            text-align: center;
          }

          .step-number {
            margin: 0 auto;
          }

          .url-display {
            flex-direction: column;
          }

          .url-display code {
            width: 100%;
            text-align: center;
          }
        }

        @media (max-width: 480px) {
          .features-grid {
            grid-template-columns: 1fr;
          }

          .seb-warning-banner {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
        </DashboardLayout>
    )
}

export default SEBInstructions
