import { Check } from 'lucide-react'

const STEPS = ['Cliente', 'Itens e valores', 'Conferir e confirmar']

// Etapas do orçamento no topo do editor e da revisão. current começa em 1.
export function QuoteSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="oc-steps" aria-label="Etapas do orçamento">
      {STEPS.map((label, i) => {
        const n = i + 1
        const state = n < current ? 'is-done' : n === current ? 'is-current' : ''
        return (
          <li key={label} className={`oc-steps__item ${state}`} aria-current={n === current ? 'step' : undefined}>
            <span className="oc-steps__n">{n < current ? <Check size={16} aria-hidden="true" /> : n}</span>
            <span>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
