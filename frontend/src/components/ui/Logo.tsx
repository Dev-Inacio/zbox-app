import { useId } from 'react'
import './Logo.css'

type LogoProps = {
  size?: 'md' | 'lg' // md = header, lg = tela de login
}

// Logo oficial do ZBOX: cubo de metal com topo de cobre + "ZBOX" metálico
// com profundidade em cobre + slogan embaixo.
// Um componente só, para o logo ser IGUAL em todas as telas.
export function Logo({ size = 'md' }: LogoProps) {
  // Ids únicos para os degradês do SVG (sem caracteres especiais)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const top = `${uid}-topo`
  const left = `${uid}-esq`
  const right = `${uid}-dir`

  return (
    <span className={`logo logo--${size}`}>
      {/* Cubo em perspectiva: topo de cobre, laterais de alumínio escovado */}
      <svg className="logo__mark" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id={top} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E88A4E" />
            <stop offset="1" stopColor="#B5562A" />
          </linearGradient>
          <linearGradient id={left} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E4E7EA" />
            <stop offset="1" stopColor="#9AA0A6" />
          </linearGradient>
          <linearGradient id={right} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#A3A9AF" />
            <stop offset="1" stopColor="#5C6268" />
          </linearGradient>
        </defs>
        <polygon className="logo__face logo__face--top" points="16,2 30,10 16,18 2,10" fill={`url(#${top})`} />
        <polygon className="logo__face logo__face--left" points="2,10 16,18 16,31 2,23" fill={`url(#${left})`} />
        <polygon className="logo__face logo__face--right" points="30,10 16,18 16,31 30,23" fill={`url(#${right})`} />
        <polyline className="logo__face logo__face--top" points="2,10 16,18 30,10" fill="none" stroke="#7E3415" strokeWidth="0.6" />
      </svg>
      <span className="logo__text">
        <span className="logo__name">ZBOX</span>
        <span className="logo__tagline">Serralheria e esquadrias</span>
      </span>
    </span>
  )
}
