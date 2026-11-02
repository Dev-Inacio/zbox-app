import {
  BadgeCheck, Ban, Banknote, BanknoteArrowDown, BanknoteX, Calendar, ChartColumn, ChartPie, ChevronDown, ChevronLeft,
  ChevronRight, CircleCheck, CirclePlus, CircleX, Clock, Download, Eye, FilePen, FileText, Hammer, House, Info, Layers,
  Lock, LogOut, MessageCircle, Package, PackageCheck, Pencil, PiggyBank, Play, Plus, Printer, Search, Send, Trash2,
  TriangleAlert, Truck, User, UserCheck, UserX, Wallet, Wrench, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { IconBadge } from './IconBadge'
import type { IconTone } from './IconBadge'

// Ícone do ZBOX pelo SIGNIFICADO (padrão "gradiente vivo", pacote zbox-icones-gradiente de 25/10):
// ícone de linha branco num quadrado em degradê; cada significado tem sempre o mesmo desenho e a mesma cor.
// A tabela abaixo segue o LEIA-ME do pacote e a atualização de design de 25/10 (tons suaves). Única exceção do padrão: o menu ☰ do celular (fica só em linha).
const ICONS = {
  money: [BanknoteArrowDown, 'green'], // dinheiro entrou
  payment: [Banknote, 'green'],        // registrar pagamento
  profit: [PiggyBank, 'green'],        // sobrou para você
  check: [CircleCheck, 'green'],       // pago / feito
  wallet: [Wallet, 'green'],           // financeiro
  waiting: [Clock, 'amber'],           // falta receber
  alert: [TriangleAlert, 'red'],       // atrasado / prejuízo
  trash: [Trash2, 'red'],              // excluir
  cancel: [Ban, 'red'],                // cancelar
  chart: [ChartColumn, 'blue'],        // resumo do mês
  edit: [Pencil, 'blue'],              // editar / corrigir
  info: [Info, 'blue'],                // informação
  play: [Play, 'blue'],                // iniciar produção
  calendar: [Calendar, 'blue'],        // data / período
  chat: [MessageCircle, 'whatsapp'],   // cobrar / enviar pelo WhatsApp
  order: [Package, 'orange'],          // pedido
  home: [House, 'orange'],             // início
  plus: [Plus, 'orange'],              // novo / lançar
  arrowLeft: [ChevronLeft, 'soft-orange'], // voltar (suave, design 25/10)
  quote: [FileText, 'red'],            // orçamento (folha do orçamento = vermelho; roxo agora é só "Enviado")
  download: [Download, 'red'],         // baixar PDF
  pdfFile: [FileText, 'red'],          // arquivo PDF anexado (vermelho, como todo mundo reconhece um PDF)
  customer: [User, 'teal'],            // cliente / perfil
  truck: [Truck, 'teal'],              // entregar
  material: [Layers, 'slate'],         // material
  printer: [Printer, 'slate'],         // imprimir
  search: [Search, 'slate'],           // buscar
  arrowRight: [ChevronRight, 'orange'], // abrir
  arrowDown: [ChevronDown, 'orange'],   // aberto
  logout: [LogOut, 'soft-gray'],       // sair (suave, design 25/10)
  close: [X, 'slate'],                 // fechar
  eye: [Eye, 'soft-gray'],             // mostrar senha (suave, design 25/10)
  labor: [Hammer, 'brown'],            // mão de obra
  lock: [Lock, 'gray'],                // só Admin e Gerente
  // Selos de situação (tamanho 18 dentro do selo)
  statusPartial: [ChartPie, 'amber'],
  statusUnpaid: [BanknoteX, 'gray'],
  statusNew: [CirclePlus, 'orange'],
  statusInProduction: [Wrench, 'blue'],
  statusReady: [PackageCheck, 'teal'],
  statusDelivered: [Truck, 'green'],
  statusApproved: [CircleCheck, 'green'],
  statusSent: [Send, 'violet'],
  statusConfirmed: [BadgeCheck, 'blue'],
  statusDraft: [FilePen, 'slate'],
  statusRejected: [CircleX, 'red'],
  statusCanceled: [Ban, 'gray'],
  statusActive: [UserCheck, 'green'],
  statusInactive: [UserX, 'gray'],
} satisfies Record<string, [LucideIcon, IconTone]>

export type AppIconName = keyof typeof ICONS

type Props = {
  name: AppIconName
  size?: number      // lado do quadrado: 18 nos selos de situação, 20 em selos, 28 em botões, 40–56 em quadros, 88 em telas vazias
  onAccent?: boolean // dentro de botão laranja: quadrado branco translúcido
  className?: string
}

// Tamanhos: 18 e 20 ficam como estão (selos); menor que isso vira 20; de botão (até 28) vira 28.
// Tons suaves têm tamanho próprio no design: voltar 26, olho 30, sair 28.
const SOFT_SIZE: Partial<Record<string, number>> = { arrowLeft: 26, eye: 30, logout: 28 }
export function AppIcon({ name, size = 28, onAccent = false, className }: Props) {
  const [Icon, tone] = ICONS[name]
  const side = SOFT_SIZE[name] ?? (size === 18 || size === 20 ? size : size <= 16 ? 20 : size <= 28 ? 28 : size)
  return <span className={className} style={{ display: 'inline-flex', flex: 'none' }}><IconBadge icon={Icon} tone={tone} size={side} onAccent={onAccent} /></span>
}
