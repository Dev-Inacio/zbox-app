import { Search } from 'lucide-react'
import type { ReactNode } from 'react'

// Busca à esquerda e filtro "Mostrar" à direita: o mesmo em todas as listas.
export function ListFilters({ value, onChange, placeholder, hint, testId, children }: { value: string; onChange: (v: string) => void; placeholder: string; hint?: string; testId?: string; children?: ReactNode }) {
  return (
    <div role="search" className="zv-filters">
      <label className="zv-search">
        <span className="sr-only">Buscar</span>
        <Search size={22} strokeWidth={1.8} aria-hidden="true" />
        <input type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" data-testid={testId} />
        {hint && <span className="cl-field__hint" role="status">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

export function SegFilter<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="zv-seg-box">
      <span>{label}</span>
      <div className="zv-seg" role="group" aria-label={label}>
        {options.map((o) => <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
      </div>
    </div>
  )
}
