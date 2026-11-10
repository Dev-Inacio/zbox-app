import { formatMoney } from '../orcamentos/money'

// Régua do cliente (conversa de 11/10): numa serralheria, a mão de obra (o que sobra depois do material)
// costuma ficar entre 30% e 45% do valor do serviço. Não é fixo, por isso é uma FAIXA:
//   abaixo de 0%   → prejuízo de verdade: os gastos passaram o valor do serviço (saiu do bolso)
//   0% a 30%       → prejuízo: sobrou pouco para a mão de obra
//   30% a 45%      → normal
//   acima de 45%   → ótimo
// Se um dia a faixa mudar (ou virar configuração no Perfil), muda só aqui.
export const LABOR_MIN_PERCENT = 30
export const LABOR_GOOD_PERCENT = 45

export type ProfitHealth = 'OUT_OF_POCKET' | 'LOW' | 'NORMAL' | 'GREAT'

export type HealthResult = {
  health: ProfitHealth
  percent: number      // sobra ÷ valor do serviço, 1 casa
  missingCents: number // quanto faltou para chegar nos 30% (0 se chegou)
}

// totalCents: valor do serviço | leftCents: valor do serviço − gastos
export function profitHealth(totalCents: number, leftCents: number): HealthResult {
  const percent = totalCents > 0 ? Math.round((leftCents / totalCents) * 1000) / 10 : 0
  const minCents = Math.round((totalCents * LABOR_MIN_PERCENT) / 100)
  const missingCents = Math.max(0, minCents - leftCents)
  const health: ProfitHealth = leftCents < 0 ? 'OUT_OF_POCKET'
    : percent < LABOR_MIN_PERCENT ? 'LOW'
      : percent <= LABOR_GOOD_PERCENT ? 'NORMAL'
        : 'GREAT'
  return { health, percent, missingCents }
}

export const isLoss = (h: ProfitHealth) => h === 'OUT_OF_POCKET' || h === 'LOW'

export function formatPercentBR(n: number): string {
  return `${String(n).replace('.', ',')}%`
}

// ---------- O que o quadro "Gastos e lucro" mostra (o MESMO no pedido e no Financeiro) ----------
export type ProfitInput = {
  totalCents: number
  materialCents: number
  expectedProfitCents: number  // quando receber tudo: serviço − gastos
}

export type ProfitView = {
  title: string
  valueCents: number
  note: string
  tone: 'loss' | 'pending' | 'ok'
  rate: HealthResult | null    // régua dos 30% a 45% (null = ainda sem material lançado)
  laborLeftCents: number       // serviço − material: a mão de obra
  ownLabor: boolean            // só lançou material: a mão de obra é o que sobrou para você
}

export function profitView(p: ProfitInput): ProfitView {
  // Regra do cliente (11/10): mão de obra NÃO é gasto, é o que sobra para quem faz o serviço.
  //   Serviço R$ 1.500 − material R$ 1.000 = mão de obra R$ 500 (sobrou para você).
  // (Gasto antigo do tipo "mão de obra" ainda desconta, para não sumir dinheiro já lançado.)
  const laborLeftCents = p.expectedProfitCents
  // Régua dos 30% a 45%: só depois de lançar o material (sem material, ainda não se sabe quanto sobra)
  const rate = p.expectedProfitCents < 0 || p.materialCents > 0 ? profitHealth(p.totalCents, laborLeftCents) : null
  const loss = rate !== null && isLoss(rate.health)
  const ownLabor = p.expectedProfitCents >= 0

  // O valor é SEMPRE serviço − material (o cliente achou confuso ver R$ 0,00 ao lado de "Ótimo · 50%").
  // O que o cliente ainda não pagou fica só no quadro Pagamento.
  const title = loss ? 'Prejuízo neste serviço' : 'Sobrou para você'
  const valueCents = p.expectedProfitCents
  const note = rate ? healthText(rate, laborLeftCents) : 'Lance o material: o que sobrar do valor do serviço é a sua mão de obra.'
  const tone = loss ? 'loss' : rate === null ? 'pending' : 'ok'
  return { title, valueCents, note, tone, rate, laborLeftCents, ownLabor }
}

// Frase simples, para quem não entende de finanças
export function healthText(r: HealthResult, leftCents: number): string {
  const range = `O normal é de ${LABOR_MIN_PERCENT}% a ${LABOR_GOOD_PERCENT}%.`
  switch (r.health) {
    case 'OUT_OF_POCKET': return `Os gastos passaram o valor do serviço: ${formatMoney(-leftCents)} saíram do seu bolso.`
    case 'LOW': return `Sobrou só ${formatPercentBR(r.percent)} do valor do serviço. ${range} Faltaram ${formatMoney(r.missingCents)} para chegar em ${LABOR_MIN_PERCENT}%.`
    case 'NORMAL': return 'Sua mão de obra ficou dentro do normal.'
    case 'GREAT': return 'Sua mão de obra ficou acima do normal. Ótimo serviço!'
  }
}
