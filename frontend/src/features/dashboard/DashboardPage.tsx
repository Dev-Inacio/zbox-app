import { useCallback, useState } from 'react'
import { Ban, Banknote, ChevronRight, CircleCheck, FileText, Layers, MessageCircle, Plus, TriangleAlert, Truck, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { StatusTag } from '../../components/zbox'
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

// HU25 — Início com números reais: o que precisa de atenção hoje.

// "domingo, 4 de outubro" no formato brasileiro
function todayLabel() {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()).replace(/^./, (c) => c.toUpperCase())
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
      <PageHero title={`${greeting()}, ${user?.name ?? ''}`} subtitle={todayLabel()}
        actions={<Link to="/orcamentos/novo" className="zv-btn zv-btn--primary zv-btn--top zv-m-full" data-testid="dash-novo-orcamento"><Plus size={20} strokeWidth={1.8} aria-hidden="true" />Novo orçamento</Link>} />

      <main className="zv-home">
        {d && d.unpaid.length > 0 && (
          <div className="zv-note zv-note--warning" role="status">
            <TriangleAlert size={24} strokeWidth={1.8} aria-hidden="true" />
            <span>
              <b className="zv-d-only">{d.unpaid.length === 1 ? '1 cliente está devendo' : `${d.unpaid.length} clientes estão devendo`} depois da entrega</b>
              <b className="zv-m-only">{d.unpaid.length === 1 ? '1 cliente devendo' : `${d.unpaid.length} clientes devendo`}</b>
              <span className="zv-d-only">Juntos, falta receber <span className="zb-nowrap">{formatMoney(d.overdueCents)}</span>. Use o botão Cobrar para mandar a mensagem pelo WhatsApp.</span>
              <span className="zv-m-only">Falta receber {formatMoney(d.overdueCents)} depois da entrega.</span>
            </span>
          </div>
        )}

        {state === 'error' ? <SectionCard title="Destaques" state="error" onRetry={retry} /> : d ? <StatBand d={d} /> : <SectionCard title="Destaques" state="loading" onRetry={retry} />}

        <section className="zv-card" aria-labelledby="t-naopagaram">
          <div className="zv-card__head">
            <div>
              <h2 id="t-naopagaram" className="zv-h2"><span className="zv-d-only">Clientes que ainda não pagaram</span><span className="zv-m-only">Ainda não pagaram</span></h2>
              <p className="zv-sub"><span className="zv-d-only">Entregues e sem pagar, do mais antigo para o mais novo.</span><span className="zv-m-only">Entregues e sem pagar</span></p>
            </div>
            <Link to="/financeiro?filtro=OVERDUE" className="zv-link">Ver todos<ChevronRight size={18} aria-hidden="true" /></Link>
          </div>
          {d && <Unpaid d={d} onCollect={setCollect} />}
        </section>

        <section className="zv-card" aria-labelledby="t-andamento">
          <div className="zv-card__head">
            <div>
              <h2 id="t-andamento" className="zv-h2">Pedidos em andamento</h2>
              <p className="zv-sub zv-m-hide">Ainda não entregues.</p>
            </div>
            <Link to="/pedidos" className="zv-link">Ver pedidos<ChevronRight size={18} aria-hidden="true" /></Link>
          </div>
          {d && <InProgress d={d} />}
        </section>

        <section className="zv-card zv-home-activity" aria-labelledby="t-atividades">
          <div className="zv-card__head">
            <div>
              <h2 id="t-atividades" className="zv-h2">Últimas atividades</h2>
              <p className="zv-sub">Pagamentos, orçamentos e materiais.</p>
            </div>
            <Link to="/financeiro?aba=recebidos" className="zv-link">Ver tudo<ChevronRight size={18} aria-hidden="true" /></Link>
          </div>
          {recentes.state === 'empty' && <p className="zv-sub">Nada por aqui ainda.</p>}
          {recentes.state === 'error' && <button type="button" className="zv-btn" onClick={recentes.retry}>Tentar novamente</button>}
          {recentes.state === 'success' && (
            <ul className="zv-act">
              {recentes.items.map((item) => {
                const Icon = ACTIVITY_ICON[item.kind]
                return (
                  <li key={item.id}>
                    <span className="zv-act__icon"><Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
                    <span className="zv-two"><Link to={item.to}>{item.title}</Link><span>{item.detail}</span></span>
                    <span className="zv-act__when">{item.when}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>

      {collect && (
        <CollectDialog target={collect} onCancel={() => setCollect(null)}
          onDone={() => { setCollect(null); setToast('WhatsApp aberto. Confira a mensagem e envie por lá.'); retry() }} />
      )}
      <Toast message={toast} onClose={clearToast} />
    </>
  )
}

function greeting() {
  const hour = new Date().getHours()
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many
}

// R$ 15.521,50 → R$ 15,5 mil (celular)
function shortMoney(cents: number) {
  if (cents < 1000000) return formatMoney(cents)
  return `R$ ${(cents / 100000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
}

function StatBand({ d }: { d: Dashboard }) {
  const tiles: { to: string; icon: LucideIcon; label: string; short: string; value: string; shortValue?: string; hint: string; danger?: boolean; alert?: string; testId: string }[] = [
    { to: '/orcamentos?status=SENT', icon: FileText, label: 'Aguardando resposta', short: 'Aguardando', value: String(d.quotesAwaitingAnswer), hint: `${plural(d.quotesAwaitingAnswer, 'orçamento enviado', 'orçamentos enviados')}`, testId: 'stat-aguardando' },
    { to: '/pedidos?status=IN_PRODUCTION', icon: Wrench, label: 'Em produção', short: 'Em produção', value: String(d.ordersInProduction), hint: `${plural(d.ordersInProduction, 'pedido', 'pedidos')}${d.ordersNew > 0 ? ` · ${d.ordersNew} ${plural(d.ordersNew, 'novo', 'novos')}` : ''}`, testId: 'stat-producao' },
    { to: '/pedidos?status=READY', icon: Truck, label: 'Prontos', short: 'Prontos', value: String(d.ordersReady), hint: 'para entregar', testId: 'stat-prontos' },
    { to: '/financeiro', icon: Banknote, label: 'Falta receber', short: 'Falta receber', value: formatMoney(d.receivableCents), shortValue: shortMoney(d.receivableCents), hint: `em ${d.receivableOrders} ${plural(d.receivableOrders, 'pedido', 'pedidos')}`, danger: d.receivableCents > 0, alert: d.overdueOrders > 0 ? `${d.overdueOrders} ${plural(d.overdueOrders, 'atrasado', 'atrasados')} · ${formatMoney(d.overdueCents)}` : undefined, testId: 'total-a-receber' },
  ]
  return (
    <section className="zv-band" aria-label="Destaques">
      {tiles.map((t) => (
        <Link key={t.testId} to={t.to} data-testid={t.testId}>
          <span className="zv-band__label">
            <span className="zv-band__icon"><t.icon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
            <span className="zv-band__full">{t.label}</span><span className="zv-band__short">{t.short}</span>
          </span>
          <span className={`zv-band__value${t.danger ? ' is-danger' : ''}`}><span className="zv-band__full">{t.value}</span><span className="zv-band__short">{t.shortValue ?? t.value}</span></span>
          <span className="zv-band__hint">{t.hint}</span>
          {t.alert && <span className="zv-band__alert" data-testid="total-atrasado">{t.alert}</span>}
          <span className="zv-band__see">Ver<ChevronRight size={18} aria-hidden="true" /></span>
        </Link>
      ))}
    </section>
  )
}

function Unpaid({ d, onCollect }: { d: Dashboard; onCollect: (t: CollectTarget) => void }) {
  if (d.unpaid.length === 0) return <p className="zv-sub">Ninguém devendo depois da entrega.</p>
  return (
    <div className="zv-table-wrap">
      <table className="zv-table" data-testid="nao-pagaram">
        <thead><tr><th scope="col">Cliente</th><th scope="col">Entregue há</th><th scope="col" className="zv-r">Falta receber</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
        <tbody>
          {d.unpaid.map((u) => (
            <tr key={u.orderId}>
              <td><span className="zv-two"><Link to={`/pedidos/${u.orderId}`}>{u.customerName}</Link><span>Pedido #{u.number}</span></span></td>
              <td className="zv-m-hide"><StatusTag tone="danger">{sinceDelivery(u.daysSinceDelivery)}</StatusTag></td>
              <td className="zv-r zv-m-right"><b>{formatMoney(u.remainingCents)}</b><span className="zv-m-only"><StatusTag tone="danger">{sinceDelivery(u.daysSinceDelivery)}</StatusTag></span></td>
              <td className="zv-r zv-m-hide">
                <button type="button" className="zv-btn" onClick={() => onCollect({ id: u.orderId, number: u.number, customerName: u.customerName, customerWhatsapp: u.customerWhatsapp, remainingCents: u.remainingCents })}>
                  <MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" />Cobrar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function sinceDelivery(days: number) {
  return days <= 0 ? 'hoje' : days === 1 ? '1 dia' : `${days} dias`
}

function InProgress({ d }: { d: Dashboard }) {
  if (d.inProgress.length === 0) return <p className="zv-sub">Nenhum pedido em andamento.</p>
  return (
    <div className="zv-table-wrap">
      <table className="zv-table" data-testid="em-andamento">
        <thead><tr><th scope="col">Cliente</th><th scope="col">Situação</th><th scope="col" className="zv-r">Desde</th></tr></thead>
        <tbody>
          {d.inProgress.map((u) => (
            <tr key={u.orderId}>
              <td><span className="zv-two"><Link to={`/pedidos/${u.orderId}`}>{u.customerName}</Link><span>Pedido #{u.number}</span></span></td>
              <td><OrderStatusBadge status={u.status} /></td>
              <td className="zv-r zv-m-hide"><span className="zv-two"><span>{formatDayShort(u.createdOn)}</span><span>{u.daysOpen <= 0 ? 'feito hoje' : u.daysOpen === 1 ? 'há 1 dia' : `há ${u.daysOpen} dias`}</span></span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ACTIVITY_ICON: Record<ActivityItem['kind'], LucideIcon> = {
  pagamento: Banknote, estorno: Ban, cobranca: MessageCircle, orcamento: FileText, aprovado: CircleCheck, material: Layers,
}
