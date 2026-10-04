// ⚠️ SIMULAÇÃO (mock): o conteúdo das seções e o endpoint ainda serão definidos
// pela PO e pelo Back-end (HU04/HU05). Os números abaixo são só exemplos.
//
// Para testar os estados, coloque na URL do navegador:
//   ?destaques=vazio    ?destaques=erro
//   ?recentes=vazio     ?recentes=erro
//   (dá para combinar: ?destaques=erro&recentes=vazio)

// Um número de destaque (HU04)
export type StatItem = {
  id: string
  label: string
  value: string
  hint: string
  attention?: boolean // pede ação → aparece em destaque laranja
}

// Uma atividade recente (HU05)
export type ActivityStatus = 'enviado' | 'parcial' | 'entregue'

export type ActivityItem = {
  id: number
  kind: 'orcamento' | 'pagamento' | 'pedido'
  title: string
  detail: string
  status: ActivityStatus
  when: string
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function simulate<T>(section: string, items: T[], delay: number) {
  return async (): Promise<T[]> => {
    await wait(delay)
    const mode = new URLSearchParams(window.location.search).get(section)
    if (mode === 'erro') throw new Error(`Falha simulada em ${section}`)
    if (mode === 'vazio') return []
    return items
  }
}

export const getDestaques = simulate<StatItem>(
  'destaques',
  [
    { id: 'orcamentos-pendentes', label: 'Orçamentos pendentes', value: '8', hint: 'aguardando confirmação' },
    { id: 'pedidos-producao', label: 'Pedidos em produção', value: '5', hint: '2 vencem esta semana' },
    { id: 'pedidos-atrasados', label: 'Pedidos atrasados', value: '2', hint: 'precisam de atenção', attention: true },
    { id: 'a-receber', label: 'A receber', value: 'R$ 18.400', hint: 'em 6 pedidos' },
  ],
  800,
)

export const getRecentes = simulate<ActivityItem>(
  'recentes',
  [
    { id: 1, kind: 'orcamento', title: 'Orçamento #000123 enviado pelo WhatsApp', detail: 'Cliente Exemplo Ltda · por Thayná', status: 'enviado', when: 'há 10 min' },
    { id: 2, kind: 'pagamento', title: 'Pagamento de R$ 2.000 registrado no pedido #0045', detail: 'PIX · por Inavio', status: 'parcial', when: 'há 1 h' },
    { id: 3, kind: 'pedido', title: 'Pedido #0044 entregue', detail: 'Recebido por Maria · por Thayná', status: 'entregue', when: 'ontem' },
  ],
  1200,
)
