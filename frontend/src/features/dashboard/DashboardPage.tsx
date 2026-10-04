import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { SectionCard } from '../../components/ui/SectionCard'
import type { LoadState } from '../../components/ui/SectionCard'
import { Toast } from '../../components/ui/Toast'
import { useRequest } from '../../hooks/useRequest'
import { useAuth } from '../auth/useAuth'
import { formatMoney } from '../orcamentos/money'
import { formatDayShort } from '../pedidos/dates'
import { OrderStatusBadge } from '../pedidos/OrderBadges'
import { CollectDialog } from '../pedidos/OrderDialogs'
import type { CollectTarget } from '../pedidos/messages'
import { getDashboard, getRecentes } from './dashboardApi'
import type { ActivityItem, Dashboard } from './dashboardApi'
import { useSectionData } from './useSectionData'
import '../../components/ui/ButtonVariants.css'
import '../pedidos/Pedidos.css'
import './DashboardPage.css'

// HU25 — Início com números reais: o que precisa de atenção hoje.

// "domingo, 4 de outubro" no formato brasileiro
function todayLabel() {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
}

export function DashboardPage() {
  const { user } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const dash = useRequest(`dash#${attempt}`, getDashboard)
  const recentes = useSectionData(getRecentes)
  const [collect, setCollect] = useState<CollectTarget | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const state: LoadState = dash.loading ? 'loading' : dash.error ? 'error' : 'success'
  const retry = () => setAttempt((n) => n + 1)
  const d = dash.data

  return (
    <>
      {/* Faixa grafite que continua o cabeçalho */}
      <div className="dash-hero">
        <div className="dash-hero__inner">
          <div className="dash-hero__text">
            <p className="dash-hero__date">{todayLabel()}</p>
            <h1 className="dash-hero__title">Olá, {user?.name}</h1>
            <p className="dash-hero__subtitle">Veja como está a empresa hoje.</p>
          </div>
          <Link to="/orcamentos/novo" className="dash-hero__cta" data-testid="dash-novo-orcamento">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Novo orçamento
          </Link>
        </div>
      </div>

      <main className="dash">
        <SectionCard title="Destaques" elevated state={state} onRetry={retry}>
          {d && <StatGrid d={d} />}
        </SectionCard>

        <div className="dash-two">
          <SectionCard title="Clientes que ainda não pagaram" action={<Link to="/financeiro?filtro=OVERDUE">Ver todos</Link>} state={state} onRetry={retry}>
            {d && <Unpaid d={d} onCollect={setCollect} />}
          </SectionCard>
          <SectionCard title="Em andamento" action={<Link to="/pedidos">Ver pedidos</Link>} state={state} onRetry={retry}>
            {d && <InProgress d={d} />}
          </SectionCard>
        </div>

        <SectionCard title="Recentes" state={recentes.state} onRetry={recentes.retry}>
          <ActivityList items={recentes.items} />
        </SectionCard>
      </main>

      {collect && (
        <CollectDialog target={collect} onCancel={() => setCollect(null)}
          onDone={() => { setCollect(null); setToast('WhatsApp aberto. Confira a mensagem e envie por lá.'); retry() }} />
      )}
      <Toast message={toast} onClose={clearToast} />
    </>
  )
}

function StatGrid({ d }: { d: Dashboard }) {
  const stats = [
    { id: 'aguardando', to: '/orcamentos?status=SENT', label: 'Orçamentos aguardando resposta', value: String(d.quotesAwaitingAnswer), hint: d.quotesToSend > 0 ? `+ ${d.quotesToSend} confirmado${d.quotesToSend > 1 ? 's' : ''} para enviar` : 'enviados ao cliente', attention: false },
    { id: 'producao', to: '/pedidos?status=IN_PRODUCTION', label: 'Pedidos em produção', value: String(d.ordersInProduction), hint: d.ordersNew > 0 ? `+ ${d.ordersNew} novo${d.ordersNew > 1 ? 's' : ''} para começar` : 'nenhum novo esperando', attention: false },
    { id: 'prontos', to: '/pedidos?status=READY', label: 'Prontos para entregar', value: String(d.ordersReady), hint: d.ordersReady > 0 ? 'aguardando entrega' : 'nenhum pronto agora', attention: false },
    { id: 'receber', to: '/financeiro', label: 'A receber', value: formatMoney(d.receivableCents), hint: d.receivableOrders === 1 ? 'em 1 pedido' : `em ${d.receivableOrders} pedidos`, attention: false },
  ]
  return (
    <ul className="stat-grid">
      {stats.map((s) => (
        <li key={s.id}>
          <Link to={s.to} className={`stat stat--link${s.attention ? ' stat--attention' : ''}${s.id === 'receber' ? ' stat--money' : ''}`} data-testid={`stat-${s.id}`}>
            <span className="stat__label">
              {s.attention && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 7v5l3 2" /></svg>}
              {s.label}
            </span>
            <span className="stat__value">{s.value}</span>
            <span className="stat__hint">{s.hint}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Unpaid({ d, onCollect }: { d: Dashboard; onCollect: (t: CollectTarget) => void }) {
  if (d.unpaid.length === 0) return <p className="section-card__message">Ninguém devendo depois da entrega.</p>
  return (
    <>
      <p className="dash-note">Pedidos entregues com valor a receber, do mais antigo para o mais novo.</p>
      <ul className="dash-list" data-testid="nao-pagaram">
        {d.unpaid.map((u) => (
          <li key={u.orderId} className="dash-list__row">
            <span className="dash-list__text">
              <Link to={`/pedidos/${u.orderId}`} className="dash-list__title">{u.customerName}</Link>
              <span className="dash-list__detail">Pedido #{u.number} · entregue {u.daysSinceDelivery <= 0 ? 'hoje' : u.daysSinceDelivery === 1 ? 'ontem' : `há ${u.daysSinceDelivery} dias`}</span>
            </span>
            <span className="dash-list__money"><span>Falta</span><strong>{formatMoney(u.remainingCents)}</strong></span>
            <button type="button" className="btn btn--secondary dash-list__btn" onClick={() => onCollect({ id: u.orderId, number: u.number, customerName: u.customerName, customerWhatsapp: u.customerWhatsapp, remainingCents: u.remainingCents })}>
              Cobrar
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

function InProgress({ d }: { d: Dashboard }) {
  if (d.inProgress.length === 0) return <p className="section-card__message">Nenhum pedido em andamento.</p>
  return (
    <>
      <p className="dash-note">Pedidos ainda não entregues, dos mais antigos para os mais novos.</p>
      <ul className="dash-list" data-testid="em-andamento">
        {d.inProgress.map((u) => (
          <li key={u.orderId} className="dash-list__row">
            <span className="dash-list__text">
              <Link to={`/pedidos/${u.orderId}`} className="dash-list__title">{u.customerName}</Link>
              <span className="dash-list__detail pd-badges">#{u.number} <OrderStatusBadge status={u.status} /></span>
            </span>
            <span className="dash-list__due">
              <strong>{formatDayShort(u.createdOn)}</strong>
              <span>{u.daysOpen <= 0 ? 'feito hoje' : u.daysOpen === 1 ? 'há 1 dia' : `há ${u.daysOpen} dias`}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
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
            <Link to={item.to} className="activity__title">{item.title}</Link>
            <span className="activity__detail">{item.detail}</span>
          </div>
          <span className={`badge badge--${item.badge.tone}`}>{item.badge.label}</span>
          <span className="activity__when">{item.when}</span>
        </li>
      ))}
    </ul>
  )
}
