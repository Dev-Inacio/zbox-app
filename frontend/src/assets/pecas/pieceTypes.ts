// Tipos de peça (código → nome). O SVG fica em public/pecas/{codigo}.svg.
// O back deve aceitar só estes códigos (400 INVALID_PIECE_TYPE para outro valor).
export const PIECE_TYPES = {
  'janela-de-correr-2-folhas': 'Janela de correr 2 folhas',
  'janela-de-correr-4-folhas': 'Janela de correr 4 folhas',
  'janela-maxim-ar': 'Janela maxim-ar',
  'janela-basculante': 'Janela basculante',
  'veneziana': 'Veneziana',
  'janela-pivotante': 'Janela pivotante',
  'porta-de-abrir': 'Porta de abrir',
  'porta-pivotante': 'Porta pivotante',
  'porta-de-correr': 'Porta de correr',
  'porta-camarao': 'Porta camarão',
  'porta-de-vidro-com-fixo': 'Porta de vidro com fixo',
  'box-de-correr': 'Box de correr',
  'box-de-abrir': 'Box de abrir',
  'espelho': 'Espelho',
  'portao-basculante': 'Portão basculante',
  'portao-de-correr': 'Portão de correr',
  'portao-de-abrir-2-folhas': 'Portão de abrir 2 folhas',
  'grade-de-protecao': 'Grade de proteção',
  'guarda-corpo-de-vidro': 'Guarda-corpo de vidro',
  'corrimao': 'Corrimão',
  'cobertura-de-policarbonato': 'Cobertura de policarbonato',
  'fachada-pele-de-vidro': 'Fachada pele de vidro',
  'divisoria': 'Divisória',
  'tela-mosquiteira': 'Tela mosquiteira',
  'outra-peca-sob-medida': 'Outra peça (sob medida)',
  'contramarco': 'Contramarco',
  'janela-boca-de-lobo': 'Janela boca de lobo',
  'alcapao': 'Alçapão',
  'escada-marinheiro': 'Escada marinheiro',
  'fechamento-de-varanda': 'Fechamento de varanda',
} as const

export type PieceType = keyof typeof PIECE_TYPES
export const PIECE_OPTIONS = (Object.keys(PIECE_TYPES) as PieceType[]).map((value) => ({ value, label: PIECE_TYPES[value] }))
