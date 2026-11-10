// Só formata para mostrar. Todos os valores vêm do back em centavos — o front nunca recalcula total.
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const money = (cents: number) => BRL.format(cents / 100).replace(/ /g, ' ')
