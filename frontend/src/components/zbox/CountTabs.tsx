import { CountChip } from './Chips'
import './zbox.css'

export type CountTab<K extends string> = { key: K; label: string; count: number }

// Abas com contador: "Orçamentos 2 · Pedidos 1 · Pagamentos 1"
export function CountTabs<K extends string>({ tabs, active, onChange, label }: { tabs: CountTab<K>[]; active: K; onChange: (k: K) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="zb-tabs">
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={t.key === active} className="zb-tab" onClick={() => onChange(t.key)}>
          {t.label} <CountChip>{t.count}</CountChip>
        </button>
      ))}
    </div>
  )
}
