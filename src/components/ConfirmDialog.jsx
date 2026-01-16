import { useState, createContext, useContext, useCallback } from 'react'

// Context for confirm dialog
const ConfirmContext = createContext(null)

// Provider component
export function ConfirmProvider({ children }) {
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        onCancel: null
    })

    const showConfirm = useCallback(({ title = 'Konfirmasi', message, onConfirm, onCancel }) => {
        setConfirmState({
            isOpen: true,
            title,
            message,
            onConfirm,
            onCancel
        })
    }, [])

    const handleConfirm = () => {
        confirmState.onConfirm?.()
        setConfirmState(prev => ({ ...prev, isOpen: false }))
    }

    const handleCancel = () => {
        confirmState.onCancel?.()
        setConfirmState(prev => ({ ...prev, isOpen: false }))
    }

    return (
        <ConfirmContext.Provider value={{ showConfirm }}>
            {children}
            {confirmState.isOpen && (
                <div className="confirm-overlay" onClick={handleCancel}>
                    <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
                        <div className="confirm-header">
                            <h3>{confirmState.title}</h3>
                        </div>
                        <div className="confirm-body">
                            <p>{confirmState.message}</p>
                        </div>
                        <div className="confirm-footer">
                            <button
                                className="btn btn-ghost"
                                onClick={handleCancel}
                            >
                                Batal
                            </button>
                            <button
                                className="btn btn-error"
                                onClick={handleConfirm}
                            >
                                Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .confirm-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    backdrop-filter: blur(4px);
                    animation: fadeIn 0.15s ease;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .confirm-dialog {
                    background: var(--color-surface, #fff);
                    border-radius: 12px;
                    padding: 0;
                    min-width: 320px;
                    max-width: 90vw;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    animation: slideUp 0.2s ease;
                }
                @keyframes slideUp {
                    from { 
                        opacity: 0;
                        transform: translateY(20px) scale(0.95); 
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0) scale(1); 
                    }
                }
                .confirm-header {
                    padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid var(--color-border, #e5e7eb);
                }
                .confirm-header h3 {
                    margin: 0;
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--color-text, #1f2937);
                }
                .confirm-body {
                    padding: 1.5rem;
                }
                .confirm-body p {
                    margin: 0;
                    color: var(--color-text-secondary, #6b7280);
                    line-height: 1.5;
                }
                .confirm-footer {
                    padding: 1rem 1.5rem;
                    border-top: 1px solid var(--color-border, #e5e7eb);
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                }
                .btn-error {
                    background: #ef4444 !important;
                    color: white !important;
                    border: none !important;
                }
                .btn-error:hover {
                    background: #dc2626 !important;
                }
            `}</style>
        </ConfirmContext.Provider>
    )
}

// Hook to use confirm dialog
export function useConfirm() {
    const context = useContext(ConfirmContext)
    if (!context) {
        throw new Error('useConfirm must be used within ConfirmProvider')
    }
    return context
}

// Helper function for easy usage
export function confirmDelete(showConfirm, message, onConfirm) {
    showConfirm({
        title: 'Konfirmasi Hapus',
        message: message || 'Apakah Anda yakin ingin menghapus data ini?',
        onConfirm
    })
}
