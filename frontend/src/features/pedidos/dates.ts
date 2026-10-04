// Datas "de calendário" (data do pagamento, data da entrega) vão como "YYYY-MM-DD", sem hora.
// Por quê: "20/10" é o dia 20 para todo mundo. Se virasse data-hora em UTC, à noite no Brasil
// já seria o dia 21 em UTC e a data "andaria" um dia. O fuso da empresa é America/Sao_Paulo.

const TZ = 'America/Sao_Paulo'

export function todayIso(): string {
  // "sv-SE" formata como 2026-10-04
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ })
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

// Diferença em dias de calendário: b − a
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

// "2026-10-20" → "20/10/2026"  (sem passar por Date, para não mudar de dia por fuso)
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// "2026-10-20" → "20/10"
export function formatDayShort(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// Data-hora ISO → dia de calendário em São Paulo
export function isoDateTimeToDay(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ })
}


// "entregue há 35 dias" / "entregue hoje"
export function sinceText(day: string, today = todayIso()): string {
  const diff = daysBetween(day, today)
  if (diff <= 0) return 'hoje'
  if (diff === 1) return 'ontem'
  return `há ${diff} dias`
}
