import { X, BookOpen, Clock, FileText, MapPin, AlertCircle, Timer } from 'lucide-react'

// Shared "Konfirmasi Mulai Ujian" dialog. Used by the Ujian list page and the
// student dashboard so "Kerjakan Sekarang" opens the confirmation directly
// without a detour through the Ujian menu.
export default function ConfirmExamModal({ isOpen, onClose, exam, onStart }) {
    if (!isOpen || !exam) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-md" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h3>Konfirmasi Mulai Ujian</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                            Pastikan Anda siap sebelum memulai
                        </p>
                    </div>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    <div className="confirm-exam-info">
                        <div className="confirm-exam-header">
                            <span className={`badge badge-${exam.tipeUjian === 'UTS' ? 'primary' : exam.tipeUjian === 'UAS' ? 'error' : 'accent'}`}>
                                {exam.tipeUjian}
                            </span>
                            <h2>{exam.namaUjian || `${exam.tipeUjian} ${exam.matkulName}`}</h2>
                            <p>{exam.matkulName}</p>
                        </div>

                        <div className="confirm-exam-details">
                            <div className="confirm-detail-item">
                                <BookOpen size={20} />
                                <div>
                                    <span className="detail-label">Dosen Pengampu</span>
                                    <span className="detail-value">{exam.dosenName || '-'}</span>
                                </div>
                            </div>
                            <div className="confirm-detail-item">
                                <Clock size={20} />
                                <div>
                                    <span className="detail-label">Durasi Waktu</span>
                                    <span className="detail-value">{exam.durasi} menit</span>
                                </div>
                            </div>
                            <div className="confirm-detail-item">
                                <FileText size={20} />
                                <div>
                                    <span className="detail-label">Jumlah Soal</span>
                                    <span className="detail-value">{exam.jumlahSoal || '-'} soal</span>
                                </div>
                            </div>
                            <div className="confirm-detail-item">
                                <MapPin size={20} />
                                <div>
                                    <span className="detail-label">Ruangan</span>
                                    <span className="detail-value">{exam.ruang || '-'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="confirm-warning">
                            <AlertCircle size={20} />
                            <div>
                                <strong>Perhatian!</strong>
                                <p>Timer akan mulai berjalan setelah Anda menekan tombol "Mulai Ujian". Pastikan koneksi internet stabil dan Anda siap mengerjakan ujian.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Batal</button>
                    <button className="btn btn-primary" onClick={() => onStart(exam)}>
                        <Timer size={16} />
                        Mulai Ujian Sekarang
                    </button>
                </div>
            </div>

            <style>{`
                .confirm-exam-info {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }
                .confirm-exam-header {
                    text-align: center;
                    padding-bottom: var(--space-4);
                    border-bottom: 1px solid var(--border-color);
                }
                .confirm-exam-header h2 {
                    margin: var(--space-2) 0 var(--space-1);
                    font-size: var(--font-size-xl);
                }
                .confirm-exam-header p {
                    margin: 0;
                    color: var(--text-secondary);
                }
                .confirm-exam-details {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: var(--space-3);
                }
                .confirm-detail-item {
                    display: flex;
                    align-items: flex-start;
                    gap: var(--space-3);
                    padding: var(--space-3);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                }
                .confirm-detail-item svg {
                    color: var(--primary-500);
                    flex-shrink: 0;
                }
                .confirm-detail-item > div {
                    display: flex;
                    flex-direction: column;
                }
                .confirm-detail-item .detail-label {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .confirm-detail-item .detail-value {
                    font-weight: var(--font-medium);
                }
                .confirm-warning {
                    display: flex;
                    gap: var(--space-3);
                    padding: var(--space-4);
                    background: var(--warning-50);
                    border: 1px solid var(--warning-200);
                    border-radius: var(--radius-md);
                }
                [data-theme="dark"] .confirm-warning {
                    background: rgba(245, 158, 11, 0.1);
                    border-color: rgba(245, 158, 11, 0.3);
                }
                .confirm-warning svg {
                    color: var(--warning-600);
                    flex-shrink: 0;
                }
                .confirm-warning strong {
                    color: var(--warning-700);
                    display: block;
                    margin-bottom: var(--space-1);
                }
                .confirm-warning p {
                    margin: 0;
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                }
                @media (max-width: 640px) {
                    .confirm-exam-details {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    )
}
