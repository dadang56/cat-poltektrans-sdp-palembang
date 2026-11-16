import { useState, useEffect } from 'react'
import { CheckSquare, X } from 'lucide-react'
import './BulkFillBar.css'

// Bar shown while rows are ticked: give every ticked student the same value.
//   fields: [{ key, label }] — which score to fill (a picker when > 1)
//   onApply(fieldKey, number) — may be async; the bar waits for it
export default function BulkFillBar({ count, fields = [], min = 0, max = 100, step = 1, onApply, onClear, hint }) {
    const [field, setField] = useState(fields[0]?.key || '')
    const [value, setValue] = useState('')
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!fields.some(f => f.key === field)) setField(fields[0]?.key || '')
    }, [fields, field])

    if (count === 0) return null

    const num = value === '' ? NaN : Number(value)
    const valid = !Number.isNaN(num) && num >= min && num <= max

    const apply = async () => {
        if (!valid || busy) return
        setBusy(true)
        try {
            await onApply(field, num)
            setValue('')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="bulk-fill-bar" role="region" aria-label="Isi nilai sekaligus">
            <div className="bulk-fill-count">
                <CheckSquare size={18} />
                <span><strong>{count}</strong> mahasiswa dipilih</span>
            </div>
            <div className="bulk-fill-form">
                {fields.length > 1 && (
                    <select className="form-input bulk-fill-field" value={field} onChange={e => setField(e.target.value)} aria-label="Komponen nilai">
                        {fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                )}
                <input
                    type="number"
                    className="form-input bulk-fill-value"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    placeholder={`${min}–${max}`}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') apply() }}
                    aria-label="Nilai"
                />
                <button className="btn btn-primary bulk-fill-apply" onClick={apply} disabled={!valid || busy}>
                    {busy ? 'Menyimpan…' : `Isi ke ${count} mahasiswa`}
                </button>
                <button className="btn btn-ghost bulk-fill-clear" onClick={onClear} disabled={busy} title="Batal pilih">
                    <X size={16} />
                    <span>Batal</span>
                </button>
            </div>
            {hint && <p className="bulk-fill-hint">{hint}</p>}
        </div>
    )
}
