import { SectionCard } from '../../components/ui/SectionCard'
import type { AuthUser } from '../auth/types'
import { getDestaques, getRecentes } from './dashboardApi'
import type { ActivityItem, ActivityStatus, StatItem } from './dashboardApi'
import { useSectionData } from './useSectionData'
import './DashboardPage.css'

type DashboardPageProps = {
  user: AuthUser
}

// "sábado, 4 de outubro" no formato brasileiro
function todayLabel() {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
}

export function DashboardPage({ user }: DashboardPageProps) {
  // As duas seções carregam em paralelo e de forma independente (HU05)
  const destaques = useSectionData(getDestaques)
  const recentes = useSectionData(getRecentes)

  return (
    <>
      {/* Faixa grafite que continua o cabeçalho */}
      <div className="dash-hero">
        <div className="dash-hero__inner">
          <div className="dash-hero__text">
            <p className="dash-hero__date">{todayLabel()}</p>
            <h1 className="dash-hero__title">Olá, {user.name}</h1>
            <p className="dash-hero__subtitle">Veja como está a empresa hoje.</p>
          </div>
          {/* O fluxo de orçamento é da Fase 3; por enquanto o botão fica desabilitado */}
          <button type="button" className="dash-hero__cta" disabled title="Disponível na Fase 3 (Orçamentos)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Novo orçamento
          </button>
        </div>
      </div>

      <main className="dash">
        <SectionCard
          title="Destaques"
          badge="Dados de exemplo"
          elevated
          state={destaques.state}
          onRetry={destaques.retry}
        >
          <StatGrid items={destaques.items} />
        </SectionCard>

        <SectionCard
          title="Recentes"
          action={<a href="#historico">Ver tudo</a>}
          state={recentes.state}
          onRetry={recentes.retry}
        >
          <ActivityList items={recentes.items} />
        </SectionCard>
      </main>
    </>
  )
}

function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <ul className="stat-grid">
      {items.map((item) => (
        <li key={item.id} className={`stat${item.attention ? ' stat--attention' : ''}`}>
          <span className="stat__label">{item.label}</span>
          <span className="stat__value">{item.value}</span>
          <span className="stat__hint">{item.hint}</span>
        </li>
      ))}
    </ul>
  )
}

const STATUS_LABEL: Record<ActivityStatus, string> = {
  enviado: 'Enviado',
  parcial: 'Parcial',
  entregue: 'Entregue',
}

function ActivityIcon({ kind }: { kind: ActivityItem['kind'] }) {
  const common = {
    width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
  }
  if (kind === 'pagamento') {
    return <svg {...common}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><path d="M7 15h3" /></svg>
  }
  if (kind === 'pedido') {
    return <svg {...common}><path d="M3 7l9-4 9 4-9 4z" /><path d="M3 7v10l9 4 9-4V7" /></svg>
  }
  return <svg {...common}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
}

function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="activity">
      {items.map((item) => (
        <li key={item.id} className="activity__row">
          <span className="activity__icon"><ActivityIcon kind={item.kind} /></span>
          <div className="activity__text">
            <span className="activity__title">{item.title}</span>
            <span className="activity__detail">{item.detail}</span>
          </div>
          <span className={`badge badge--${item.status}`}>{STATUS_LABEL[item.status]}</span>
          <span className="activity__when">{item.when}</span>
        </li>
      ))}
    </ul>
  )
}
