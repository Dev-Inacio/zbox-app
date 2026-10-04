import { addDaysIso, todayIso } from '../pedidos/dates'

// Período do "Recebido". O front transforma a escolha em from/to (YYYY-MM-DD) para a API.
export type Period = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30' | 'LAST_90'

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'THIS_MONTH', label: 'Este mês' },
  { value: 'LAST_MONTH', label: 'Mês passado' },
  { value: 'LAST_30', label: 'Últimos 30 dias' },
  { value: 'LAST_90', label: 'Últimos 90 dias' },
]

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function readPeriod(value: string | null): Period {
  return PERIODS.some((p) => p.value === value) ? (value as Period) : 'THIS_MONTH'
}

export function periodRange(period: Period, today = todayIso()): { from: string; to: string; label: string } {
  const [y, m] = today.split('-').map(Number)
  if (period === 'THIS_MONTH') return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: today, label: `em ${MONTHS[m - 1]}` }
  if (period === 'LAST_MONTH') {
    const py = m === 1 ? y - 1 : y
    const pm = m === 1 ? 12 : m - 1
    const first = `${py}-${String(pm).padStart(2, '0')}-01`
    const last = addDaysIso(`${y}-${String(m).padStart(2, '0')}-01`, -1)
    return { from: first, to: last, label: `em ${MONTHS[pm - 1]}` }
  }
  const days = period === 'LAST_30' ? 30 : 90
  return { from: addDaysIso(today, -(days - 1)), to: today, label: `nos últimos ${days} dias` }
}
