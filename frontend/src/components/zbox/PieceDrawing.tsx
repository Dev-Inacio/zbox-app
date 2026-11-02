import { PIECE_TYPES, type PieceType } from '../../assets/pecas/pieceTypes'
import './zbox.css'

const INK = '#1B1F23'
const LINE = '#5A6067'
const GLASS = '#9AA3AB'

// Boca de lobo: continua com o desenho próprio do sistema (decisão de 31/10). Requadro fundo e uma travessa dividindo o vidro.
function BocaDeLobo({ size, className }: { size: number; className: string }) {
  return (
    <svg className={className} width={size} height={Math.round(size * 78 / 96)} viewBox="0 0 96 78" role="img" aria-label={PIECE_TYPES['janela-boca-de-lobo']}>
      <rect x="12" y="6" width="56" height="56" fill="#FFFFFF" stroke={INK} strokeWidth="1.5" />
      <rect x="16.5" y="10.5" width="47" height="47" fill="#F6F5F2" stroke={INK} strokeWidth="0.9" />
      <g stroke={LINE} strokeWidth="0.7">
        <line x1="12" y1="6" x2="16.5" y2="10.5" />
        <line x1="68" y1="6" x2="63.5" y2="10.5" />
        <line x1="12" y1="62" x2="16.5" y2="57.5" />
        <line x1="68" y1="62" x2="63.5" y2="57.5" />
      </g>
      <rect x="16.5" y="35.35" width="47" height="2" fill="#FFFFFF" stroke={INK} strokeWidth="0.8" />
      <g stroke={GLASS} strokeWidth="0.8" strokeLinecap="round">
        <line x1="24.96" y1="20.58" x2="30.67" y2="14.87" />
        <line x1="24.96" y1="24.73" x2="34.82" y2="14.87" />
      </g>
    </svg>
  )
}

// Mostra o desenho da peça (mesmo SVG do PDF). Sem tipo → "Outra peça (sob medida)".
export function PieceDrawing({ type, size = 48, className = 'zb-piece' }: { type: PieceType | null | undefined; size?: number; className?: string }) {
  const t = type ?? 'outra-peca-sob-medida'
  if (t === 'janela-boca-de-lobo') return <BocaDeLobo size={size} className={className} />
  return <img src={`/pecas/${t}.svg`} alt="" width={size} height={Math.round(size * 78 / 96)} className={className} />
}

// Linha embaixo do item no editor: [desenho] Desenho no PDF: Janela boca de lobo
export function PiecePreview({ type }: { type: PieceType | null | undefined }) {
  const t = type ?? 'outra-peca-sob-medida'
  return (
    <span className="zb-piece-preview" data-testid="item-desenho">
      <PieceDrawing type={t} size={40} />
      <span>Desenho no PDF: <strong>{PIECE_TYPES[t]}</strong></span>
    </span>
  )
}
