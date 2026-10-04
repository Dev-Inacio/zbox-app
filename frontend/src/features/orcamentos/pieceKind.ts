// Tipo da peça descoberto pelas palavras da descrição (os itens são texto livre, não há catálogo).
// Usado para escolher o desenho do PDF e para mostrar a dica no editor.

export type PieceKind =
  | 'BOX'
  | 'GATE' | 'GATE_SLIDING' | 'GATE_TILTING'
  | 'DOOR' | 'DOOR_SLIDING' | 'DOOR_PIVOT' | 'DOOR_GLASS' | 'DOOR_BALCONY'
  | 'WINDOW_SLIDING' | 'WINDOW_FIXED' | 'WINDOW_PROJECTING' | 'WINDOW_TILT' | 'WINDOW_BOCA_DE_LOBO' | 'LOUVER'
  | 'GRILLE' | 'RAILING' | 'HANDRAIL'
  | 'FACADE' | 'PARTITION' | 'SCREEN'
  | 'ROOF' | 'SKYLIGHT' | 'STORM_GRATE' | 'SILL' | 'AC_BRACKET'
  | 'MIRROR' | 'GLASS' | 'GENERIC'

export const PIECE_LABEL: Record<PieceKind, string> = {
  BOX: 'Box',
  GATE: 'Portão de grade', GATE_SLIDING: 'Portão de correr', GATE_TILTING: 'Portão basculante',
  DOOR: 'Porta de abrir', DOOR_SLIDING: 'Porta de correr', DOOR_PIVOT: 'Porta pivotante',
  DOOR_GLASS: 'Porta com vidro', DOOR_BALCONY: 'Porta balcão',
  WINDOW_SLIDING: 'Janela de correr', WINDOW_FIXED: 'Esquadria fixa', WINDOW_PROJECTING: 'Janela maxim-ar',
  WINDOW_TILT: 'Basculante', WINDOW_BOCA_DE_LOBO: 'Janela boca de lobo', LOUVER: 'Veneziana',
  GRILLE: 'Grade de proteção', RAILING: 'Guarda-corpo', HANDRAIL: 'Corrimão',
  FACADE: 'Fachada de vidro', PARTITION: 'Divisória', SCREEN: 'Tela mosquiteiro',
  ROOF: 'Cobertura', SKYLIGHT: 'Claraboia', STORM_GRATE: 'Grelha/bueiro', SILL: 'Peitoril',
  AC_BRACKET: 'Suporte de ar-condicionado',
  MIRROR: 'Espelho', GLASS: 'Vidro', GENERIC: 'Peça',
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Palavras que o cliente costuma escrever (sem acento: o texto é normalizado antes).
// Cada palavra vale como INÍCIO de palavra: 'portao' pega "portão" e "portões"; 'maxi' pega "maxim-ar", "maxi-ar", "maxiar".
// Inclui sinônimos, plurais e erros comuns de digitação ("basculhante", "corre mão").
const WORDS = {
  box: ['box', 'boxe'],
  bocaDeLobo: ['boca de lobo', 'boca-de-lobo', 'boca '], // "boca" sozinha já é a janela boca de lobo // janela de requadro fundo com travessa (não é a grelha da rua)
  stormGrate: ['grelha', 'bueiro', 'ralo', 'canaleta'],
  skylight: ['claraboia', 'clarabo', 'domo', 'zenital', 'lanternim'],
  roof: ['cobertura', 'telhado', 'toldo', 'pergol', 'marquise'],
  facade: ['fachada', 'pele de vidro', 'cortina de vidro', 'vitrine', 'frente de loja'],
  partition: ['divisori', 'biombo', 'painel divisor'],
  screen: ['mosquiteir', 'tela', 'telinha'],
  ac: ['ar-condicionado', 'ar condicionado', 'ar-cond', 'condensadora', 'split', 'suporte de ar', 'suporte ar'],
  sill: ['peitoril', 'pingadeira', 'soleira', 'chapim'],
  handrail: ['corrimao', 'corre mao', 'corre-mao', 'corremao'],
  railing: ['guarda-corpo', 'guarda corpo', 'guardacorpo', 'gradil', 'parapeito'],
  gate: ['portao', 'portoes', 'garagem'],
  door: ['porta ', 'portas ', 'portinh'], // palavra inteira: "portal" não é porta
  sliding: ['correr', 'corre ', 'deslizante', 'corredic', 'corredi'],
  tilting: ['basculante', 'basculhante', 'bascul', 'levadic'],
  pivot: ['pivotante', 'pivo', 'pivotad'],
  balcony: ['balcao'],
  doorGlass: ['vidro', 'visor', 'vidrad', 'envidracad', 'blindex'],
  louver: ['veneziana', 'palheta', 'ventilad', 'brise'],
  projecting: ['maxim-ar', 'maxi-ar', 'max-ar', 'maxim '], // o "-" também aceita espaço ou junto: "maxim ar", "maximar"
  window: ['janela', 'vitro', 'esquadria', 'caixilho', 'vidraca'],
  fixed: ['fixa', 'fixo', 'fixas', 'fixos'],
  leaves: ['folha', 'fls', 'fl '],
  grille: ['grade', 'gradead'],
  mirror: ['espelho'],
  glass: ['vidro', 'tampo', 'prateleira', 'temperado', 'laminado', 'blindex'],
}

// ---------- Entender a escrita do cliente ----------
// Antes de escolher o desenho, cada palavra é "traduzida":
//   1. abreviação conhecida  → palavra inteira  ("jan" → janela, "pta" → porta, "fls" → folhas)
//   2. erro de digitação     → palavra mais parecida, se faltar/sobrar/trocar 1 letra (2 em palavras longas)
//                              ("janla" → janela, "potao" → portao, "venesiana" → veneziana)

const ABBREVIATIONS: Record<string, string> = {
  jan: 'janela', jnl: 'janela', jnla: 'janela',
  pt: 'porta', pta: 'porta', prt: 'porta', port: 'porta',
  ptao: 'portao', prtao: 'portao', pto: 'portao',
  basc: 'basculante', bascul: 'basculante',
  corr: 'correr', desl: 'deslizante', piv: 'pivotante',
  vit: 'vitro', esq: 'esquadria', mx: 'maxim', max: 'maxim',
  fl: 'folha', fls: 'folhas', fh: 'folha', fhs: 'folhas',
  gc: 'guarda corpo', esp: 'espelho', vd: 'vidro', temp: 'temperado',
  boka: 'boca', div: 'divisoria', mosq: 'mosquiteiro', cob: 'cobertura', vnz: 'veneziana', ven: 'veneziana',
}

// Palavras conhecidas (inteiras), usadas para corrigir erro de digitação
const KNOWN_WORDS = [
  'janela', 'janelas', 'janelao', 'porta', 'portas', 'portao', 'portoes', 'garagem', 'balcao',
  'correr', 'deslizante', 'corredica', 'basculante', 'basculantes', 'pivotante', 'maxim', 'veneziana', 'venezianas',
  'vitro', 'esquadria', 'esquadrias', 'caixilho', 'folha', 'folhas', 'fixa', 'fixo',
  'grade', 'grades', 'gradeado', 'gradil', 'guarda', 'corpo', 'corrimao', 'parapeito',
  'box', 'espelho', 'vidro', 'vidros', 'temperado', 'laminado', 'tampo', 'prateleira', 'blindex', 'visor',
  'fachada', 'vitrine', 'divisoria', 'divisorias', 'biombo', 'mosquiteiro', 'tela',
  'cobertura', 'telhado', 'toldo', 'pergolado', 'marquise', 'claraboia', 'zenital',
  'grelha', 'bueiro', 'canaleta', 'peitoril', 'pingadeira', 'soleira',
  'condicionado', 'condensadora', 'suporte', 'boca', 'lobo',
]
const KNOWN_SET = new Set(KNOWN_WORDS)

// Palavras de verdade que ficam a 1 letra de uma palavra conhecida e NÃO podem ser "corrigidas"
// ("grande" não é "grade", "tampa" não é "tampo", "portal" não é "portão")
const NOT_TYPOS = new Set([
  'grande', 'grandes', 'porte', 'parte', 'parta', 'porto', 'portal', 'portais', 'forte', 'folga', 'pasta',
  'tampa', 'tampas', 'vidra', 'fixar', 'fixe', 'corpos', 'janta', 'jantar', 'lobos', 'bocal', 'telha', 'telhas',
  'tecla', 'velas', 'corte', 'cortar', 'correia', 'medida', 'medidas', 'maximo', 'maxima', 'portar', 'portes',
])

// Quantas letras diferentes entre duas palavras (inserir, apagar, trocar ou inverter vizinhas)
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

function fixWord(word: string): string {
  if (ABBREVIATIONS[word]) return ABBREVIATIONS[word]
  if (word.length < 5 || KNOWN_SET.has(word) || NOT_TYPOS.has(word) || /\d/.test(word)) return word
  const limit = word.length >= 8 ? 2 : 1
  let best = word
  let bestDistance = limit + 1
  for (const known of KNOWN_WORDS) {
    if (known[0] !== word[0] || Math.abs(known.length - word.length) > limit) continue // mesma 1ª letra: evita trocas estranhas
    const distance = editDistance(word, known)
    if (distance < bestDistance) { best = known; bestDistance = distance }
  }
  return best
}

// Texto "entendido": sem acento, minúsculo, abreviações abertas e erros corrigidos
export function understand(description: string): string {
  return normalize(description)
    .replace(/\bcorre[\s-]*mao/g, 'corrimao') // "corre mão" antes de "corre" virar "correr"
    .split(/[^a-z0-9,]+/)
    .filter(Boolean)
    .map(fixWord)
    .join(' ')
}

type Group =
  | 'box' | 'bocaDeLobo' | 'stormGrate' | 'skylight' | 'roof' | 'facade' | 'partition' | 'screen' | 'ac' | 'sill'
  | 'handrail' | 'railing' | 'gate' | 'door' | 'window' | 'grille' | 'mirror' | 'glass'

// Nome principal de cada peça. Em empate de posição, vale a ordem desta lista.
const GROUPS: [Group, string[]][] = [
  ['box', WORDS.box],
  ['bocaDeLobo', WORDS.bocaDeLobo],
  ['stormGrate', WORDS.stormGrate],
  ['skylight', WORDS.skylight],
  ['roof', WORDS.roof],
  ['facade', WORDS.facade],
  ['partition', WORDS.partition],
  ['screen', WORDS.screen],
  ['ac', WORDS.ac],
  ['sill', WORDS.sill],
  ['handrail', WORDS.handrail],
  ['railing', WORDS.railing],
  ['gate', WORDS.gate],
  ['door', WORDS.door],
  ['window', [...WORDS.window, ...WORDS.louver, ...WORDS.projecting, ...WORDS.tilting]],
  ['grille', WORDS.grille],
  ['mirror', WORDS.mirror],
  ['glass', WORDS.glass],
]

function wordRegex(word: string): RegExp {
  // "ar-condicionado" também pega "ar condicionado" e "arcondicionado"
  return new RegExp(`\\b${word.replace(/-/g, '[- ]?')}`)
}

// A peça é a que aparece PRIMEIRO na descrição: o cliente começa pelo nome do item.
//   "Janela de correr com tela"     → janela (a tela é detalhe)
//   "Tela mosquiteiro para janela"  → tela
// Depois, as outras palavras escolhem a variação ("portão" + "correr" → portão de correr).
export function detectPiece(description: string): PieceKind {
  const t = ` ${understand(description)} `
  const has = (words: string[]) => words.some((w) => wordRegex(w).test(t))
  const firstIndex = (words: string[]) =>
    Math.min(...words.map((w) => t.search(wordRegex(w))).filter((i) => i >= 0), Infinity)

  // "porta de garagem" é portão, mesmo começando com "porta"
  let group: Group | null = has(['porta de garagem', 'porta da garagem', 'porta garagem']) ? 'gate' : null
  if (!group) {
    let best = Infinity
    for (const [g, words] of GROUPS) {
      const i = firstIndex(words)
      if (i < best) { best = i; group = g }
    }
  }

  switch (group) {
    case 'box': return 'BOX'
    case 'bocaDeLobo': return 'WINDOW_BOCA_DE_LOBO'
    case 'stormGrate': return 'STORM_GRATE'
    case 'skylight': return 'SKYLIGHT'
    case 'roof': return 'ROOF'
    case 'facade': return 'FACADE'
    case 'partition': return 'PARTITION'
    case 'screen': return 'SCREEN'
    case 'ac': return 'AC_BRACKET'
    case 'sill': return 'SILL'
    case 'handrail': return 'HANDRAIL'
    case 'railing': return 'RAILING'
    case 'gate':
      if (has(WORDS.sliding)) return 'GATE_SLIDING'
      if (has([...WORDS.grille, 'gradil'])) return 'GATE' // portão de grade: barras verticais
      return 'GATE_TILTING' // "portão" sozinho: o desenho do basculante
    case 'door':
      if (has(WORDS.balcony)) return 'DOOR_BALCONY'
      if (has(WORDS.sliding)) return 'DOOR_SLIDING'
      if (has(WORDS.pivot)) return 'DOOR_PIVOT'
      if (has(WORDS.doorGlass)) return 'DOOR_GLASS'
      return 'DOOR'
    case 'window':
      if (has(WORDS.bocaDeLobo)) return 'WINDOW_BOCA_DE_LOBO'
      if (has(WORDS.louver)) return 'LOUVER'
      if (has(WORDS.projecting)) return 'WINDOW_PROJECTING'
      if (has(WORDS.tilting)) return 'WINDOW_TILT'
      if (has(WORDS.fixed)) return 'WINDOW_FIXED'
      if (has(WORDS.sliding) || has(WORDS.leaves)) return 'WINDOW_SLIDING'
      if (has(['vitro', 'esquadria', 'caixilho', 'vidraca'])) return 'WINDOW_FIXED'
      return 'WINDOW_SLIDING'
    case 'grille': return 'GRILLE'
    case 'mirror': return 'MIRROR'
    case 'glass': return 'GLASS'
    default: return 'GENERIC'
  }
}

const NUMBER_WORDS: Record<string, number> = { duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6 }

// "2 folhas", "4fls", "quatro folhas"… (janelas e portas de correr). Padrão: 2. Limite visual: 2 a 6.
export function detectLeaves(description: string): number {
  // "4fls" e "4 fl" já chegam como "4 folhas" (o understand abre a abreviação); "4f" também vale
  const m = understand(description).match(/(\d+|duas|dois|tres|quatro|cinco|seis)\s*(folhas?\b|f\b)/)
  const n = m ? (NUMBER_WORDS[m[1]] ?? Number(m[1])) : 2
  return Math.min(6, Math.max(2, n))
}

// Tipos de correr: mostram "· N folhas" na dica do editor
export function isSliding(kind: PieceKind): boolean {
  return kind === 'WINDOW_SLIDING' || kind === 'DOOR_SLIDING' || kind === 'DOOR_BALCONY'
}

// Proporção (largura/altura) usada quando o item não tem medidas
export const DEFAULT_RATIO: Record<PieceKind, number> = {
  BOX: 0.75,
  GATE: 1.6, GATE_SLIDING: 1.8, GATE_TILTING: 1.4,
  DOOR: 0.45, DOOR_SLIDING: 1.1, DOOR_PIVOT: 0.5, DOOR_GLASS: 0.45, DOOR_BALCONY: 1.1,
  WINDOW_SLIDING: 1.25, WINDOW_FIXED: 1.2, WINDOW_PROJECTING: 1.3, WINDOW_TILT: 0.9, WINDOW_BOCA_DE_LOBO: 1, LOUVER: 1.2,
  GRILLE: 1.2, RAILING: 2.4, HANDRAIL: 2.6,
  FACADE: 1.3, PARTITION: 1.6, SCREEN: 1.2,
  ROOF: 1.8, SKYLIGHT: 1.6, STORM_GRATE: 2.2, SILL: 3.2, AC_BRACKET: 1.3,
  MIRROR: 0.7, GLASS: 1.2, GENERIC: 0.8,
}
