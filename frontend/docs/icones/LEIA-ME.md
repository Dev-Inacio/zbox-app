# Ícones do ZBOX (estilo "gradiente vivo")

Ícone de linha branco dentro de um quadrado em degradê. A cor segue o significado.

## No código (recomendado)
```
cd frontend
npm install lucide-react
```
Copie `src/components/ui/IconBadge.tsx` para o projeto e use:
```tsx
import { Pencil } from 'lucide-react'
import { IconBadge } from '../../components/ui/IconBadge'

<button><IconBadge icon={Pencil} tone="blue" />Editar</button>
<IconBadge icon={BanknoteArrowDown} tone="green" size={48} />  // quadro "Entrou"
```
Tamanhos: 20 em selos, 28 em botões, 40 a 56 em quadros, 88 em telas vazias.

## Arquivos SVG prontos
A pasta `svg/` tem cada ícone já com o fundo colorido (48×48), para Figma, apresentações ou o PDF.

| Ícone | Arquivo | Significado | Componente lucide-react | Cor (tone) |
|---|---|---|---|---|
| ![](svg/money-in.svg) | `money-in.svg` | Dinheiro entrou | `BanknoteArrowDown` | `green` |
| ![](svg/payment.svg) | `payment.svg` | Registrar pagamento | `Banknote` | `green` |
| ![](svg/profit.svg) | `profit.svg` | Sobrou para você | `PiggyBank` | `green` |
| ![](svg/paid.svg) | `paid.svg` | Pago / feito | `CircleCheck` | `green` |
| ![](svg/finance.svg) | `finance.svg` | Financeiro (menu) | `Wallet` | `green` |
| ![](svg/waiting.svg) | `waiting.svg` | Falta receber | `Clock` | `amber` |
| ![](svg/alert.svg) | `alert.svg` | Atrasado / prejuízo | `TriangleAlert` | `red` |
| ![](svg/delete.svg) | `delete.svg` | Excluir | `Trash2` | `red` |
| ![](svg/cancel.svg) | `cancel.svg` | Cancelar | `Ban` | `red` |
| ![](svg/chart.svg) | `chart.svg` | Resumo do mês | `ChartColumn` | `blue` |
| ![](svg/edit.svg) | `edit.svg` | Editar / corrigir | `Pencil` | `blue` |
| ![](svg/info.svg) | `info.svg` | Informação | `Info` | `blue` |
| ![](svg/start.svg) | `start.svg` | Iniciar produção | `Play` | `blue` |
| ![](svg/calendar.svg) | `calendar.svg` | Data / período | `Calendar` | `blue` |
| ![](svg/whatsapp.svg) | `whatsapp.svg` | Cobrar / enviar | `MessageCircle` | `whatsapp` |
| ![](svg/order.svg) | `order.svg` | Pedido | `Package` | `orange` |
| ![](svg/home.svg) | `home.svg` | Início (menu) | `House` | `orange` |
| ![](svg/add.svg) | `add.svg` | Novo / lançar | `Plus` | `orange` |
| ![](svg/quote.svg) | `quote.svg` | Orçamento | `FileText` | `violet` |
| ![](svg/pdf.svg) | `pdf.svg` | Baixar PDF | `Download` | `violet` |
| ![](svg/customer.svg) | `customer.svg` | Cliente / perfil | `User` | `teal` |
| ![](svg/deliver.svg) | `deliver.svg` | Entregar | `Truck` | `teal` |
| ![](svg/material.svg) | `material.svg` | Material | `Layers` | `slate` |
| ![](svg/print.svg) | `print.svg` | Imprimir | `Printer` | `slate` |
| ![](svg/search.svg) | `search.svg` | Buscar | `Search` | `slate` |
| ![](svg/open.svg) | `open.svg` | Abrir | `ChevronRight` | `orange` |
| ![](svg/opened.svg) | `opened.svg` | Aberto | `ChevronDown` | `orange` |
| ![](svg/back.svg) | `back.svg` | Voltar | `ChevronLeft` | `orange` |
| ![](svg/logout.svg) | `logout.svg` | Sair | `LogOut` | `slate` |
| ![](svg/close.svg) | `close.svg` | Fechar | `X` | `slate` |
| ![](svg/show-password.svg) | `show-password.svg` | Mostrar senha | `Eye` | `slate` |
| ![](svg/labor.svg) | `labor.svg` | Mão de obra | `Hammer` | `brown` |
| ![](svg/restricted.svg) | `restricted.svg` | Só Admin e Gerente | `Lock` | `gray` |


## Selos de situação (tamanho 18 dentro do selo)

| Ícone | Arquivo | Situação | Componente lucide-react | Cor (tone) |
|---|---|---|---|---|
| ![](svg/status-partial.svg) | `status-partial.svg` | Parcial (pagou uma parte) | `ChartPie` | `amber` |
| ![](svg/status-unpaid.svg) | `status-unpaid.svg` | Não pago | `BanknoteX` | `gray` |
| ![](svg/status-new.svg) | `status-new.svg` | Novo | `CirclePlus` | `orange` |
| ![](svg/status-in-production.svg) | `status-in-production.svg` | Em produção | `Wrench` | `blue` |
| ![](svg/status-ready.svg) | `status-ready.svg` | Pronto | `PackageCheck` | `teal` |
| ![](svg/status-delivered.svg) | `status-delivered.svg` | Entregue | `Truck` | `green` |
| ![](svg/status-approved.svg) | `status-approved.svg` | Aprovado | `CircleCheck` | `green` |
| ![](svg/status-sent.svg) | `status-sent.svg` | Enviado | `Send` | `violet` |
| ![](svg/status-confirmed.svg) | `status-confirmed.svg` | Confirmado | `BadgeCheck` | `blue` |
| ![](svg/status-draft.svg) | `status-draft.svg` | Rascunho | `FilePen` | `slate` |
| ![](svg/status-rejected.svg) | `status-rejected.svg` | Recusado | `CircleX` | `red` |
| ![](svg/status-canceled.svg) | `status-canceled.svg` | Cancelado | `Ban` | `gray` |
| ![](svg/status-active.svg) | `status-active.svg` | Cliente ativo | `UserCheck` | `green` |
| ![](svg/status-inactive.svg) | `status-inactive.svg` | Cliente desativado | `UserX` | `gray` |

Exceção: o menu ☰ do celular fica só em linha (`Menu`, sem fundo).

Licença dos desenhos: Lucide (ISC). Uso comercial liberado.
