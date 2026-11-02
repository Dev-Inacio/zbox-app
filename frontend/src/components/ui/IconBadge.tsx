import type { LucideIcon } from 'lucide-react'

// Padrão de ícone do ZBOX (opção A, "gradiente vivo"): ícone de linha branco
// dentro de um quadrado em degradê. A cor segue o significado, sempre a mesma.
// Tons "soft": fundo claro + ícone colorido, para ações secundárias (voltar, olho, sair).
export type IconTone =
  | 'green' | 'amber' | 'red' | 'blue' | 'whatsapp' | 'orange' | 'violet' | 'teal' | 'slate' | 'brown' | 'gray'
  | 'soft-orange' | 'soft-gray'

// [cor da linha, fundo suave]. Só situação tem cor própria; o resto usa o azul da marca ou o cinza.
const BRAND: [string, string] = ['var(--color-accent)', 'var(--wine-soft)']
const NEUTRAL: [string, string] = ['var(--color-text-muted)', 'var(--color-neutral-soft)']
const TONES: Record<Exclude<IconTone, 'soft-orange' | 'soft-gray'>, [string, string]> = {
  green: ['var(--color-success)', 'var(--color-success-soft)'], // dinheiro que entrou, pago
  amber: ['var(--color-warning)', 'var(--color-warning-soft)'], // falta receber
  red: ['var(--color-danger)', 'var(--color-danger-soft)'],     // atrasado, prejuízo, excluir, PDF
  whatsapp: ['var(--color-success)', 'var(--color-success-soft)'], // cobrar / enviar pelo WhatsApp
  blue: BRAND, orange: BRAND, violet: BRAND, teal: BRAND,
  slate: NEUTRAL, brown: NEUTRAL, gray: NEUTRAL,
}

const SOFT = {
  'soft-orange': { background: 'var(--wine-soft)', color: 'var(--color-accent)', border: 'none' },          // voltar
  'soft-gray': { background: '#EEF0F3', color: '#6B7280', border: '1px solid #E1E4E8' },               // olho (senha), sair
} as const

type Props = {
  icon: LucideIcon
  tone: IconTone
  size?: number      // lado do quadrado: 28 em botões, 40–56 em quadros, 88 em telas vazias
  onAccent?: boolean // dentro de botão azul: só o ícone branco
}

export function IconBadge({ icon: Icon, tone, size = 28, onAccent = false }: Props) {
  if (size <= 28) return <Icon size={Math.min(size, 20)} strokeWidth={1.8} aria-hidden="true" style={{ flex: 'none' }} />
  const base = {
    width: size, height: size, flex: 'none', borderRadius: Math.round(size * 0.3),
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' as const,
  }
  let style: React.CSSProperties
  if (tone === 'soft-orange' || tone === 'soft-gray') {
    style = { ...base, ...SOFT[tone] }
  } else {
    const [color, soft] = TONES[tone]
    style = { ...base, color: onAccent ? '#FFFFFF' : color, background: onAccent ? 'transparent' : soft }
  }
  return (
    <span aria-hidden="true" style={style}>
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  )
}
