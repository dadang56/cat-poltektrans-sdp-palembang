import { useState } from 'react'

// On-screen math symbol keyboard for essay answers.
//
// Dosen turn it on per essay question (soal.math_keyboard). It inserts
// plain Unicode text at the cursor, so answers stay ordinary text: they
// autosave, show on the grading screen and print without any extra setup.
//
// Each key: [label, text to insert, cursor offset from the start of the
// inserted text (optional, for templates like "√()")]
const GROUPS = [
    {
        id: 'dasar',
        label: 'Dasar',
        keys: [
            ['+'], ['−'], ['×'], ['÷'], ['±'], ['∓'], ['='], ['≠'], ['≈'], ['≡'],
            ['<'], ['>'], ['≤'], ['≥'], ['∞'], ['%'], ['°'], ['′'], ['″'], ['·'],
            ['( )', '()', 1], ['[ ]', '[]', 1], ['{ }', '{}', 1], ['|x|', '||', 1]
        ]
    },
    {
        id: 'pangkat',
        label: 'Pangkat & Indeks',
        keys: [
            ['x²', '²'], ['x³', '³'], ['xⁿ', 'ⁿ'], ['x⁻¹', '⁻¹'],
            ['⁰'], ['¹'], ['²'], ['³'], ['⁴'], ['⁵'], ['⁶'], ['⁷'], ['⁸'], ['⁹'], ['⁺'], ['⁻'], ['⁽'], ['⁾'],
            ['₀'], ['₁'], ['₂'], ['₃'], ['₄'], ['₅'], ['₆'], ['₇'], ['₈'], ['₉'], ['ₙ'], ['ᵢ'], ['ₓ']
        ]
    },
    {
        id: 'akar',
        label: 'Akar & Pecahan',
        keys: [
            ['√( )', '√()', 2], ['∛( )', '∛()', 2], ['∜( )', '∜()', 2], ['√'],
            ['a/b', '()/()', 1], ['½'], ['⅓'], ['⅔'], ['¼'], ['¾'], ['⅕'], ['⅛'],
            ['log', 'log()', 4], ['ln', 'ln()', 3], ['sin', 'sin()', 4], ['cos', 'cos()', 4], ['tan', 'tan()', 4]
        ]
    },
    {
        id: 'kalkulus',
        label: 'Kalkulus',
        keys: [
            ['∫'], ['∬'], ['∮'], ['∂'], ['∇'], ['Δ'], ['d/dx', 'd/dx '], ['dy/dx', 'dy/dx'],
            ['lim', 'lim(x→)', 6], ['→'], ['Σ'], ['∏'], ['∞'], ['f(x)', 'f(x)'], ['f′(x)', 'f′(x)'], ['ẋ'], ['ẍ']
        ]
    },
    {
        id: 'yunani',
        label: 'Huruf Yunani',
        keys: [
            ['α'], ['β'], ['γ'], ['δ'], ['ε'], ['ζ'], ['η'], ['θ'], ['λ'], ['μ'], ['ν'], ['ξ'],
            ['π'], ['ρ'], ['σ'], ['τ'], ['φ'], ['χ'], ['ψ'], ['ω'],
            ['Γ'], ['Δ'], ['Θ'], ['Λ'], ['Π'], ['Σ'], ['Φ'], ['Ψ'], ['Ω']
        ]
    },
    {
        id: 'himpunan',
        label: 'Himpunan & Logika',
        keys: [
            ['∈'], ['∉'], ['⊂'], ['⊆'], ['⊃'], ['∪'], ['∩'], ['∅'], ['ℕ'], ['ℤ'], ['ℚ'], ['ℝ'], ['ℂ'],
            ['∀'], ['∃'], ['¬'], ['∧'], ['∨'], ['⇒'], ['⇔'], ['∴'], ['∵']
        ]
    },
    {
        id: 'geometri',
        label: 'Geometri & Panah',
        keys: [
            ['∠'], ['⊥'], ['∥'], ['△'], ['≅'], ['∼'], ['⌀'], ['°'],
            ['→'], ['←'], ['↔'], ['↑'], ['↓'], ['⇌'], ['vektor', '⃗'], ['ȳ'], ['x̄']
        ]
    }
]

function MathKeyboard({ textareaRef, value, onChange, disabled = false }) {
    const [groupId, setGroupId] = useState(GROUPS[0].id)
    const group = GROUPS.find(g => g.id === groupId) || GROUPS[0]

    const insert = (text, cursorOffset) => {
        if (disabled) return
        const el = textareaRef?.current
        const current = value || ''
        const start = el ? el.selectionStart ?? current.length : current.length
        const end = el ? el.selectionEnd ?? current.length : current.length
        const next = current.slice(0, start) + text + current.slice(end)
        onChange(next)
        const caret = start + (cursorOffset ?? text.length)
        // Put the cursor back after React re-renders the textarea
        setTimeout(() => {
            if (!el) return
            el.focus()
            el.setSelectionRange(caret, caret)
        }, 0)
    }

    return (
        <div className="math-keyboard" aria-label="Keyboard simbol matematika">
            <div className="math-kb-tabs" role="tablist">
                {GROUPS.map(g => (
                    <button
                        key={g.id}
                        type="button"
                        role="tab"
                        aria-selected={g.id === group.id}
                        className={`math-kb-tab ${g.id === group.id ? 'active' : ''}`}
                        // keep the cursor in the answer box
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => setGroupId(g.id)}
                    >
                        {g.label}
                    </button>
                ))}
            </div>
            <div className="math-kb-keys">
                {group.keys.map(([label, text, offset], i) => (
                    <button
                        key={`${group.id}-${i}`}
                        type="button"
                        className="math-kb-key"
                        disabled={disabled}
                        title={`Sisipkan ${text ?? label}`}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => insert(text ?? label, offset)}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <style>{`
                .math-keyboard {
                    border: 1px solid var(--border-color, #e2e8f0);
                    border-radius: 16px;
                    background: var(--bg-tertiary, #f8fafc);
                    padding: 0.5rem;
                    margin-bottom: 0.6rem;
                }
                .math-kb-tabs {
                    display: flex;
                    gap: 0.35rem;
                    overflow-x: auto;
                    padding-bottom: 0.45rem;
                    scrollbar-width: thin;
                }
                .math-kb-tab {
                    flex: 0 0 auto;
                    border: 1px solid var(--border-color, #e2e8f0);
                    background: var(--bg-secondary, #fff);
                    color: var(--text-secondary, #475569);
                    border-radius: 999px;
                    padding: 0.3rem 0.75rem;
                    font-size: 0.78rem;
                    font-weight: 600;
                    cursor: pointer;
                    white-space: nowrap;
                }
                .math-kb-tab.active {
                    background: var(--primary-600, #2563eb);
                    border-color: var(--primary-600, #2563eb);
                    color: #fff;
                }
                .math-kb-keys {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.35rem;
                }
                .math-kb-key {
                    min-width: 2.4rem;
                    height: 2.4rem;
                    padding: 0 0.6rem;
                    border: 1px solid var(--border-color, #e2e8f0);
                    background: var(--bg-secondary, #fff);
                    color: var(--text-primary, #0f172a);
                    border-radius: 10px;
                    font-size: 1.05rem;
                    font-family: 'Cambria Math', 'STIX Two Math', 'Segoe UI Symbol', 'Times New Roman', serif;
                    cursor: pointer;
                    line-height: 1;
                }
                .math-kb-key:hover:not(:disabled) {
                    border-color: var(--primary-500, #3b82f6);
                    background: var(--primary-50, #eff6ff);
                }
                .math-kb-key:active:not(:disabled) {
                    transform: scale(0.96);
                }
                .math-kb-key:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    )
}

export default MathKeyboard
