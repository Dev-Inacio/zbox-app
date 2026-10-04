import type { ReactNode } from 'react'
import { DEFAULT_RATIO, PIECE_LABEL, detectLeaves, detectPiece } from './pieceKind'
import type { PieceKind } from './pieceKind'
import type { QuoteItem } from './types'

// Desenho da peça no orçamento (PDF/impressão), no estilo "desenho técnico".
// Os itens são texto livre (não há catálogo), então o tipo é descoberto pelas palavras da descrição:
// "Janela de correr 2 folhas" → janela de correr com 2 folhas; "Box de vidro" → box; etc.
// Item por m²: o desenho segue a PROPORÇÃO largura × altura e ganha as cotas (linhas de medida).

const INK = '#1B1F23'
const LINE = '#5A6067'
const GLASS = '#9AA3AB'
const ACCENT = '#A8420D'
const FILL = '#F6F5F2'

type Box = { x: number; y: number; w: number; h: number }

function Glare({ x, y, w, h }: Box) {
  // Duas riscas diagonais: convenção de desenho para "vidro"
  const s = Math.min(w, h)
  return (
    <g stroke={GLASS} strokeWidth="0.8" strokeLinecap="round">
      <line x1={x + w * 0.18} y1={y + h * 0.18 + s * 0.22} x2={x + w * 0.18 + s * 0.22} y2={y + h * 0.18} />
      <line x1={x + w * 0.18} y1={y + h * 0.18 + s * 0.38} x2={x + w * 0.18 + s * 0.38} y2={y + h * 0.18} />
    </g>
  )
}

function SlideArrow({ cx, cy, len }: { cx: number; cy: number; len: number }) {
  const a = len / 2
  return (
    <g stroke={LINE} strokeWidth="0.9" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1={cx - a} y1={cy} x2={cx + a} y2={cy} />
      <path d={`M${cx - a + 2.2} ${cy - 1.8} L${cx - a} ${cy} L${cx - a + 2.2} ${cy + 1.8}`} />
      <path d={`M${cx + a - 2.2} ${cy - 1.8} L${cx + a} ${cy} L${cx + a - 2.2} ${cy + 1.8}`} />
    </g>
  )
}

// Linhas tracejadas em "V": a ponta indica o lado da dobradiça/eixo (convenção de esquadria)
function OpeningV({ from, apex }: { from: [number, number][]; apex: [number, number] }) {
  return (
    <g stroke={LINE} strokeWidth="0.8" strokeDasharray="2.2 1.6" fill="none">
      {from.map(([fx, fy]) => <line key={`${fx}-${fy}`} x1={fx} y1={fy} x2={apex[0]} y2={apex[1]} />)}
    </g>
  )
}

// Barras verticais paralelas (portão, grade, grelha)
function VerticalBars({ from, to, top, bottom, step, width = 0.8 }: { from: number; to: number; top: number; bottom: number; step: number; width?: number }) {
  const bars: number[] = []
  for (let bx = from + step; bx < to - 1; bx += step) bars.push(bx)
  return <>{bars.map((bx) => <line key={bx} x1={bx} y1={top} x2={bx} y2={bottom} stroke={INK} strokeWidth={width} />)}</>
}

function Leaves({ b, n, door = false }: { b: Box; n: number; door?: boolean }) {
  // Folhas de correr: cada folha um pouco sobreposta à vizinha
  const inset = 2.5
  const ix = b.x + inset
  const iy = b.y + inset
  const iw = b.w - inset * 2
  const ih = b.h - inset * (door ? 1 : 2)
  const lw = iw / n
  const items: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const lx = ix + i * lw
    items.push(
      <g key={i}>
        <rect x={lx} y={iy} width={lw} height={ih} fill={FILL} stroke={INK} strokeWidth="0.9" />
        <Glare x={lx} y={iy} w={lw} h={ih} />
      </g>,
    )
  }
  return (
    <>
      {items}
      <SlideArrow cx={b.x + b.w / 2} cy={iy + ih * 0.78} len={Math.min(22, iw * 0.45)} />
    </>
  )
}

function Details({ kind, b, leaves }: { kind: PieceKind; b: Box; leaves: number }) {
  const { x, y, w, h } = b
  const inset = 2.5
  const inner: Box = { x: x + inset, y: y + inset, w: w - inset * 2, h: h - inset * 2 }
  switch (kind) {
    case 'WINDOW_SLIDING':
      return <Leaves b={b} n={leaves} />
    case 'WINDOW_FIXED':
      return (
        <>
          <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} fill={FILL} stroke={INK} strokeWidth="0.9" />
          <Glare {...inner} />
        </>
      )
    case 'WINDOW_PROJECTING':
      // Maxim-ar: eixo em cima → o "V" aponta para cima
      return (
        <>
          <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} fill={FILL} stroke={INK} strokeWidth="0.9" />
          <Glare {...inner} />
          <OpeningV from={[[inner.x, inner.y + inner.h], [inner.x + inner.w, inner.y + inner.h]]} apex={[inner.x + inner.w / 2, inner.y]} />
        </>
      )
    case 'DOOR':
      return (
        <>
          <rect x={inner.x} y={inner.y} width={inner.w} height={h - inset} fill={FILL} stroke={INK} strokeWidth="0.9" />
          <OpeningV from={[[inner.x + inner.w, inner.y], [inner.x + inner.w, y + h]]} apex={[inner.x, inner.y + (h - inset) / 2]} />
          <rect x={inner.x + inner.w - 4.5} y={inner.y + (h - inset) * 0.5 - 1} width="3" height="2" rx="0.6" fill={INK} />
        </>
      )
    case 'DOOR_PIVOT':
      return (
        <>
          <rect x={inner.x} y={inner.y} width={inner.w} height={h - inset} fill={FILL} stroke={INK} strokeWidth="0.9" />
          {/* frisos horizontais + puxador longo (típico de pivotante de alumínio) */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={inner.x + 1.5} y1={inner.y + (h - inset) * f} x2={inner.x + inner.w - 1.5} y2={inner.y + (h - inset) * f} stroke={GLASS} strokeWidth="0.6" />
          ))}
          <rect x={inner.x + inner.w - 5} y={inner.y + (h - inset) * 0.3} width="1.8" height={(h - inset) * 0.4} rx="0.9" fill={INK} />
        </>
      )
    case 'DOOR_SLIDING':
      return <Leaves b={b} n={leaves} door />
    case 'BOX': {
      // Box: folha fixa + folha de correr, com puxador
      const half = inner.w / 2
      return (
        <>
          <rect x={inner.x} y={inner.y} width={half + 2} height={h - inset} fill={FILL} stroke={INK} strokeWidth="0.9" />
          <rect x={inner.x + half - 2} y={inner.y + 1.5} width={half + 2} height={h - inset - 1.5} fill={FILL} stroke={INK} strokeWidth="0.9" />
          <Glare x={inner.x} y={inner.y} w={half} h={h - inset} />
          <Glare x={inner.x + half} y={inner.y + 1.5} w={half} h={h - inset} />
          <rect x={inner.x + half + 1} y={inner.y + (h - inset) * 0.45} width="1.4" height={(h - inset) * 0.14} rx="0.7" fill={INK} />
          <SlideArrow cx={inner.x + half} cy={inner.y + (h - inset) * 0.8} len={Math.min(18, inner.w * 0.45)} />
        </>
      )
    }
    case 'GATE':
    case 'GATE_SLIDING':
    case 'RAILING': {
      const top = kind === 'RAILING' ? y + 1.5 : inner.y
      const bottom = kind === 'RAILING' ? y + h - 1.5 : inner.y + inner.h
      return (
        <>
          <line x1={x} y1={top} x2={x + w} y2={top} stroke={INK} strokeWidth={kind === 'RAILING' ? 2 : 1.1} />
          <line x1={x} y1={bottom} x2={x + w} y2={bottom} stroke={INK} strokeWidth="1.1" />
          <VerticalBars from={inner.x} to={inner.x + inner.w} top={top} bottom={bottom} step={Math.max(3.5, Math.min(6, w / 10))} />
          {kind === 'GATE_SLIDING' && (
            <>
              {/* trilho no chão + rodízios + seta de correr */}
              <line x1={x - 4} y1={y + h + 2.2} x2={x + w + 4} y2={y + h + 2.2} stroke={LINE} strokeWidth="0.8" />
              <circle cx={x + w * 0.2} cy={y + h + 0.6} r="1.4" fill="#FFFFFF" stroke={INK} strokeWidth="0.8" />
              <circle cx={x + w * 0.8} cy={y + h + 0.6} r="1.4" fill="#FFFFFF" stroke={INK} strokeWidth="0.8" />
              <SlideArrow cx={x + w / 2} cy={y - 3} len={Math.min(24, w * 0.4)} />
            </>
          )}
        </>
      )
    }
    case 'GATE_TILTING': {
      // Basculante entreaberto (como no catálogo): a folha de lambris gira no alto e a parte de baixo
      // sai para fora; braço articulado ligando a folha ao motor na lateral
      const tl: [number, number] = [inner.x, inner.y]
      const tr: [number, number] = [inner.x + inner.w, inner.y]
      const br: [number, number] = [inner.x + inner.w - w * 0.06, inner.y + inner.h * 0.6]
      const bl: [number, number] = [x - w * 0.09, inner.y + inner.h * 0.72]
      const lerp = (a: [number, number], b: [number, number], f: number) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
      const slats = Array.from({ length: 7 }, (_, i) => (i + 1) / 8)
      const motor = { x: x + w + 1.5, y: inner.y + inner.h * 0.42, w: 4, h: 5 }
      const armFrom = lerp(tr, br, 0.55)
      return (
        <>
          {/* vão aberto: o fundo que aparece embaixo da folha */}
          <rect x={inner.x} y={inner.y} width={inner.w} height={y + h - inner.y} fill="#FFFFFF" stroke="none" />
          <polygon points={[tl, tr, br, bl].map((p) => p.join(',')).join(' ')} fill={FILL} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
          {slats.map((f) => {
            const [x1, y1] = lerp(tl, bl, f)
            const [x2, y2] = lerp(tr, br, f)
            return <line key={f} x1={x1} y1={y1} x2={x2} y2={y2} stroke={LINE} strokeWidth="0.55" />
          })}
          <line x1={armFrom[0]} y1={armFrom[1]} x2={motor.x} y2={motor.y + motor.h / 2} stroke={INK} strokeWidth="0.9" />
          <rect x={motor.x} y={motor.y} width={motor.w} height={motor.h} rx="0.8" fill="#E6E5E1" stroke={INK} strokeWidth="0.8" />
        </>
      )
    }
    case 'GRILLE':
      // Grade de proteção: barras verticais + uma travessa no meio
      return (
        <>
          <VerticalBars from={inner.x} to={inner.x + inner.w} top={inner.y} bottom={inner.y + inner.h} step={Math.max(4, Math.min(6.5, w / 8))} />
          <line x1={inner.x} y1={inner.y + inner.h / 2} x2={inner.x + inner.w} y2={inner.y + inner.h / 2} stroke={INK} strokeWidth="0.9" />
        </>
      )
    case 'HANDRAIL': {
      // Corrimão: tubo em cima, 3 montantes e o piso
      const rail = y + h * 0.28
      return (
        <>
          <line x1={x - 2} y1={rail} x2={x + w + 2} y2={rail} stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          {[x + 2, x + w / 2, x + w - 2].map((px) => <line key={px} x1={px} y1={rail} x2={px} y2={y + h} stroke={INK} strokeWidth="1.2" />)}
          <line x1={x - 4} y1={y + h} x2={x + w + 4} y2={y + h} stroke={LINE} strokeWidth="0.7" />
        </>
      )
    }
    case 'DOOR_GLASS': {
      // Porta com vidro: visor de vidro em cima, almofada embaixo
      const leafH = h - inset
      return (
        <>
          <rect x={inner.x} y={inner.y} width={inner.w} height={leafH} fill={FILL} stroke={INK} strokeWidth="0.9" />
          <rect x={inner.x + 2.5} y={inner.y + 2.5} width={inner.w - 5} height={leafH * 0.55} fill="#FFFFFF" stroke={INK} strokeWidth="0.7" />
          <Glare x={inner.x + 2.5} y={inner.y + 2.5} w={inner.w - 5} h={leafH * 0.55} />
          <OpeningV from={[[inner.x + inner.w, inner.y], [inner.x + inner.w, y + h]]} apex={[inner.x, inner.y + leafH / 2]} />
          <rect x={inner.x + inner.w - 4.5} y={inner.y + leafH * 0.62} width="3" height="2" rx="0.6" fill={INK} />
        </>
      )
    }
    case 'DOOR_BALCONY':
      // Porta balcão: folhas de correr até o chão com uma travessa na altura do peitoril
      return (
        <>
          <Leaves b={b} n={leaves} door />
          <line x1={inner.x} y1={y + h * 0.66} x2={inner.x + inner.w} y2={y + h * 0.66} stroke={INK} strokeWidth="0.8" />
        </>
      )
    case 'WINDOW_TILT': {
      // Basculante: lâminas que giram no meio (eixo tracejado em cada uma)
      const n = 3
      const ph = inner.h / n
      return (
        <>
          {Array.from({ length: n }, (_, i) => {
            const py = inner.y + i * ph
            return (
              <g key={i}>
                <rect x={inner.x} y={py} width={inner.w} height={ph} fill={FILL} stroke={INK} strokeWidth="0.8" />
                <line x1={inner.x + 1.5} y1={py + ph / 2} x2={inner.x + inner.w - 1.5} y2={py + ph / 2} stroke={LINE} strokeWidth="0.7" strokeDasharray="2.2 1.6" />
              </g>
            )
          })}
          <Glare x={inner.x} y={inner.y} w={inner.w} h={ph} />
        </>
      )
    }
    case 'WINDOW_BOCA_DE_LOBO': {
      // Boca de lobo: requadro fundo (linhas nos cantos dão a profundidade) e uma travessa dividindo o vidro
      const d = 4.5
      const glass: Box = { x: x + d, y: y + d, w: w - d * 2, h: h - d * 2 }
      const rail = glass.y + glass.h * 0.55
      return (
        <>
          <rect x={glass.x} y={glass.y} width={glass.w} height={glass.h} fill={FILL} stroke={INK} strokeWidth="0.9" />
          <g stroke={LINE} strokeWidth="0.7">
            <line x1={x} y1={y} x2={glass.x} y2={glass.y} />
            <line x1={x + w} y1={y} x2={glass.x + glass.w} y2={glass.y} />
            <line x1={x} y1={y + h} x2={glass.x} y2={glass.y + glass.h} />
            <line x1={x + w} y1={y + h} x2={glass.x + glass.w} y2={glass.y + glass.h} />
          </g>
          <rect x={glass.x} y={rail - 1} width={glass.w} height="2" fill="#FFFFFF" stroke={INK} strokeWidth="0.8" />
          <Glare x={glass.x} y={glass.y} w={glass.w} h={rail - glass.y} />
        </>
      )
    }
    case 'LOUVER': {
      // Veneziana: aletas horizontais inclinadas
      const slats: number[] = []
      for (let sy = inner.y + 3; sy < inner.y + inner.h - 1; sy += 3.2) slats.push(sy)
      return (
        <>
          <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} fill={FILL} stroke={INK} strokeWidth="0.9" />
          {slats.map((sy) => <line key={sy} x1={inner.x + 1} y1={sy} x2={inner.x + inner.w - 1} y2={sy - 1.2} stroke={LINE} strokeWidth="0.7" />)}
        </>
      )
    }
    case 'FACADE': {
      // Fachada / pele de vidro: grade de montantes e travessas, vidro em cada quadro
      const cols = Math.max(2, Math.min(5, Math.round(w / 16)))
      const rows = Math.max(2, Math.min(4, Math.round(h / 16)))
      const cw = inner.w / cols
      const rh = inner.h / rows
      return (
        <>
          <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} fill={FILL} stroke={INK} strokeWidth="0.9" />
          {Array.from({ length: cols - 1 }, (_, i) => <line key={`c${i}`} x1={inner.x + cw * (i + 1)} y1={inner.y} x2={inner.x + cw * (i + 1)} y2={inner.y + inner.h} stroke={INK} strokeWidth="1" />)}
          {Array.from({ length: rows - 1 }, (_, i) => <line key={`r${i}`} x1={inner.x} y1={inner.y + rh * (i + 1)} x2={inner.x + inner.w} y2={inner.y + rh * (i + 1)} stroke={INK} strokeWidth="0.7" />)}
          <Glare x={inner.x} y={inner.y} w={cw} h={rh} />
          <Glare x={inner.x + cw * (cols - 1)} y={inner.y + rh * (rows - 1)} w={cw} h={rh} />
        </>
      )
    }
    case 'PARTITION': {
      // Divisória: painéis com rodapé cego embaixo e vidro em cima
      const n = Math.max(2, Math.min(5, Math.round(w / 18)))
      const pw = inner.w / n
      const split = inner.y + inner.h * 0.6
      return (
        <>
          {Array.from({ length: n }, (_, i) => {
            const px = inner.x + i * pw
            return (
              <g key={i}>
                <rect x={px} y={inner.y} width={pw} height={split - inner.y} fill="#FFFFFF" stroke={INK} strokeWidth="0.8" />
                <rect x={px} y={split} width={pw} height={inner.y + inner.h - split} fill="#E6E5E1" stroke={INK} strokeWidth="0.8" />
                <Glare x={px} y={inner.y} w={pw} h={split - inner.y} />
              </g>
            )
          })}
        </>
      )
    }
    case 'SCREEN': {
      // Tela mosquiteiro: trama fina nos dois sentidos
      const lines: ReactNode[] = []
      for (let gx = inner.x + 2.5; gx < inner.x + inner.w; gx += 2.5) lines.push(<line key={`x${gx}`} x1={gx} y1={inner.y} x2={gx} y2={inner.y + inner.h} />)
      for (let gy = inner.y + 2.5; gy < inner.y + inner.h; gy += 2.5) lines.push(<line key={`y${gy}`} x1={inner.x} y1={gy} x2={inner.x + inner.w} y2={gy} />)
      return (
        <>
          <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} fill={FILL} stroke={INK} strokeWidth="0.9" />
          <g stroke={GLASS} strokeWidth="0.35">{lines}</g>
        </>
      )
    }
    case 'STORM_GRATE':
      // Boca de lobo / grelha: barras grossas e juntas
      return (
        <>
          <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} fill="#E6E5E1" stroke={INK} strokeWidth="0.9" />
          <VerticalBars from={inner.x} to={inner.x + inner.w} top={inner.y} bottom={inner.y + inner.h} step={3} width={1.4} />
        </>
      )
    case 'ROOF': {
      // Cobertura (vista lateral): telha/policarbonato inclinado sobre dois pilares
      const topL = y + h * 0.12
      const topR = y + h * 0.32
      const at = (px: number) => topL + ((topR - topL) * (px - (x - 3))) / (w + 6) + 3
      return (
        <>
          <polygon points={`${x - 3},${topL} ${x + w + 3},${topR} ${x + w + 3},${topR + 3} ${x - 3},${topL + 3}`} fill={FILL} stroke={INK} strokeWidth="1.2" />
          {[x + 3, x + w - 3].map((px) => <line key={px} x1={px} y1={at(px)} x2={px} y2={y + h} stroke={INK} strokeWidth="1.4" />)}
          <line x1={x - 4} y1={y + h} x2={x + w + 4} y2={y + h} stroke={LINE} strokeWidth="0.7" />
        </>
      )
    }
    case 'SKYLIGHT': {
      // Claraboia: base (requadro) + domo/pirâmide de vidro
      const base = y + h * 0.7
      return (
        <>
          <rect x={x} y={base} width={w} height={y + h - base} fill="#FFFFFF" stroke={INK} strokeWidth="1.3" />
          <polygon points={`${x + 1.5},${base} ${x + w * 0.22},${y + h * 0.12} ${x + w * 0.78},${y + h * 0.12} ${x + w - 1.5},${base}`} fill={FILL} stroke={INK} strokeWidth="1" />
          <Glare x={x + w * 0.28} y={y + h * 0.18} w={w * 0.44} h={base - y - h * 0.22} />
        </>
      )
    }
    case 'SILL': {
      // Peitoril (corte): parede, pedra inclinada para fora e a pingadeira embaixo da ponta
      const back = y + h * 0.3
      const front = y + h * 0.42
      const under = y + h * 0.68
      return (
        <>
          <line x1={x} y1={y} x2={x} y2={y + h} stroke={INK} strokeWidth="1.6" />
          <polygon points={`${x},${back} ${x + w},${front} ${x + w},${under} ${x},${under}`} fill={FILL} stroke={INK} strokeWidth="1.1" />
          <line x1={x + w - 4} y1={under} x2={x + w - 4} y2={under + 3} stroke={INK} strokeWidth="1" />
        </>
      )
    }
    case 'AC_BRACKET': {
      // Suporte de ar-condicionado: parede, mão-francesa e a condensadora em cima
      const shelf = y + h * 0.62
      const boxX = x + w * 0.18
      const boxW = w * 0.74
      const boxH = h * 0.48
      return (
        <>
          <line x1={x} y1={y} x2={x} y2={y + h} stroke={INK} strokeWidth="1.6" />
          <line x1={x} y1={shelf} x2={x + w} y2={shelf} stroke={INK} strokeWidth="1.4" />
          <line x1={x} y1={y + h - 2} x2={x + w * 0.75} y2={shelf} stroke={INK} strokeWidth="1.2" />
          <rect x={boxX} y={shelf - boxH} width={boxW} height={boxH} fill={FILL} stroke={INK} strokeWidth="1" />
          <circle cx={boxX + boxW * 0.38} cy={shelf - boxH / 2} r={boxH * 0.32} fill="#FFFFFF" stroke={LINE} strokeWidth="0.8" />
          {[0.72, 0.8, 0.88].map((f) => <line key={f} x1={boxX + boxW * f} y1={shelf - boxH * 0.8} x2={boxX + boxW * f} y2={shelf - boxH * 0.2} stroke={LINE} strokeWidth="0.6" />)}
        </>
      )
    }
    case 'MIRROR':
      return (
        <>
          <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} rx="1.5" fill="#EEF1F4" stroke={INK} strokeWidth="0.9" />
          <Glare {...inner} />
        </>
      )
    case 'GLASS':
      return <Glare {...b} />
    case 'GENERIC':
      return null
  }
}

// Portas e box: sem o traço de baixo (a folha vai até o piso)
const OPEN_BOTTOM = new Set<PieceKind>(['DOOR', 'DOOR_PIVOT', 'DOOR_SLIDING', 'DOOR_GLASS', 'DOOR_BALCONY', 'BOX', 'GATE_TILTING'])
// Portão e guarda-corpo: só os dois montantes laterais
const SIDE_POSTS_ONLY = new Set<PieceKind>(['GATE', 'GATE_SLIDING', 'RAILING'])
// Desenhos de perfil/elevação que fazem o próprio contorno
const DRAWS_OWN_OUTLINE = new Set<PieceKind>(['HANDRAIL', 'ROOF', 'SKYLIGHT', 'SILL', 'AC_BRACKET'])

const VIEW_W = 96
const VIEW_H = 78
const MAX_W = 64
const MAX_H = 56

export function PieceDrawing({ item, className }: { item: Pick<QuoteItem, 'description' | 'chargeType' | 'widthCm' | 'heightCm' | 'unit'>; className?: string }) {
  const kind = detectPiece(item.description)
  const leaves = detectLeaves(item.description)
  const measured = item.chargeType === 'AREA' && Boolean(item.widthCm) && Boolean(item.heightCm)
  const ratio = measured ? (item.widthCm ?? 1) / (item.heightCm ?? 1) : DEFAULT_RATIO[kind]

  // Cabe na área de desenho mantendo a proporção
  const scale = Math.min(MAX_W / ratio, MAX_H)
  const w = Math.max(10, ratio * scale)
  const h = Math.max(10, scale)
  const x = 8 + (MAX_W - w) / 2
  const y = 6 + (MAX_H - h) / 2
  const b: Box = { x, y, w, h }
  const openBottom = OPEN_BOTTOM.has(kind)
  const noFrame = SIDE_POSTS_ONLY.has(kind)
  const custom = DRAWS_OWN_OUTLINE.has(kind)
  // Cota da altura: no basculante fica mais afastada para não encostar no motor
  const cota = kind === 'GATE_TILTING' ? 10 : 6

  return (
    <svg className={className} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={PIECE_LABEL[kind]} data-piece={kind}>
      {!noFrame && !custom && (
        openBottom ? (
          <path d={`M${x} ${y + h} V${y} H${x + w} V${y + h}`} fill="none" stroke={INK} strokeWidth="1.5" />
        ) : (
          <rect x={x} y={y} width={w} height={h} fill={kind === 'GENERIC' || kind === 'GLASS' ? FILL : '#FFFFFF'} stroke={INK} strokeWidth="1.5" />
        )
      )}
      {noFrame && <>
        <line x1={x} y1={y} x2={x} y2={y + h} stroke={INK} strokeWidth="1.5" />
        <line x1={x + w} y1={y} x2={x + w} y2={y + h} stroke={INK} strokeWidth="1.5" />
      </>}
      <Details kind={kind} b={b} leaves={leaves} />
      {openBottom && <line x1={x - 3} y1={y + h} x2={x + w + 3} y2={y + h} stroke={LINE} strokeWidth="0.7" />}
      {kind === 'GENERIC' && !measured && item.unit && (
        <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize="11" fontFamily="ui-monospace, monospace" fill={LINE}>{item.unit}</text>
      )}
      {measured && (
        <g stroke={ACCENT} strokeWidth="1">
          <line x1={x} y1={y + h + 6} x2={x + w} y2={y + h + 6} />
          <line x1={x} y1={y + h + 3} x2={x} y2={y + h + 9} />
          <line x1={x + w} y1={y + h + 3} x2={x + w} y2={y + h + 9} />
          <line x1={x + w + cota} y1={y} x2={x + w + cota} y2={y + h} />
          <line x1={x + w + cota - 3} y1={y} x2={x + w + cota + 3} y2={y} />
          <line x1={x + w + cota - 3} y1={y + h} x2={x + w + cota + 3} y2={y + h} />
        </g>
      )}
    </svg>
  )
}
