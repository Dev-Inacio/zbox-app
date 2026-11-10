# HU29 · Nota fiscal no pedido — guia para o front

O ZBOX **não emite** a nota. Ele só **guarda o número** (e o PDF, opcional) da nota emitida fora.
Telas: `1-fonte-do-design/telas/computador/11-pedido-detalhe`, `11b`, `11c`, `11d` e o selo no `13-financeiro`.

## 1. Tipos (src/features/pedidos/types.ts)
```ts
export type InvoiceType = 'SERVICE' | 'PRODUCT' | 'BOTH' // Serviço (NFS-e) · Produto (NF-e) · As duas

export type Invoice = {
  number: string          // "1234"
  issuedAt: string        // "2026-11-05" (YYYY-MM-DD)
  type: InvoiceType
  notes: string | null
  hasFile: boolean
  updatedBy: string       // nome de quem anotou
  updatedAt: string       // ISO 8601
}

export type InvoiceRequest = Pick<Invoice, 'number' | 'issuedAt' | 'type' | 'notes'>

// No Order, acrescente:   invoice: Invoice | null
// Nos itens de lista (pedidos / falta receber):   invoiceNumber: string | null
```

## 2. API (src/features/pedidos/ordersApi.ts) — na SIMULAÇÃO, igual às outras
Contrato proposto ao Inácio (cartão HU29 no Trello). Enquanto o back não tem pedidos, faça no mock:
```ts
// PUT /api/orders/{id}/invoice  → 200 Invoice   (só ADMIN e MANAGER)
export async function saveInvoice(orderId: number, req: InvoiceRequest): Promise<Invoice>
// POST /api/orders/{id}/invoice/file (multipart "file") → 200 Invoice   (PDF/JPG/PNG até 5 MB)
export async function uploadInvoiceFile(orderId: number, file: File): Promise<Invoice>
// GET /api/orders/{id}/invoice/file → o arquivo (abrir numa aba / na janela "Ver PDF")
```
Validações do mock (o back vai repetir — **nunca confiar só no front**):
| Campo | Regra | Mensagem |
|---|---|---|
| number | obrigatório, até 20, letras/números | "Informe o número da nota." |
| issuedAt | obrigatório, não pode ser no futuro | "A data da nota não pode ser no futuro." |
| type | SERVICE, PRODUCT ou BOTH | "Escolha o tipo da nota." |
| notes | até 300 | "Máximo de 300 caracteres." |
| arquivo | PDF/JPG/PNG, até 5 MB | "Envie um PDF ou foto de até 5 MB." |
| pedido | não pode estar CANCELADO | 409 `ORDER_CANCELLED` → "Pedido cancelado não recebe nota." |
| perfil | EMPLOYEE | 403 `FORBIDDEN` → esconda "Anotar"/"Corrigir" para ele |

## 3. Telas
1. **Detalhe do pedido** — bloco "Nota fiscal" na coluna da direita (abaixo de Pagamento):
   - sem nota: selo tracejado "Sem nota fiscal" + botão **Anotar nota fiscal** + texto de ajuda;
   - com nota: número, data, tipo, quem anotou + **Ver PDF da nota**, **Corrigir**, **Enviar nota pelo WhatsApp**;
   - selo "NF 1234" ao lado do título do pedido.
2. **Janela "Anotar nota fiscal"** (reaproveite o `ConfirmDialog`/modal que já existe): número*, data*, tipo (segmentado), arquivo (opcional), observação. Botões Cancelar / **Salvar nota fiscal**. Sucesso: toast "Nota fiscal 1234 anotada no pedido.". Erro: mensagem no campo.
3. **Ver PDF da nota**: janela grande com o arquivo (use `<iframe>` para PDF ou `<img>` para foto), Baixar, Imprimir, Enviar pelo WhatsApp, Fechar. Aviso: "Este é o arquivo que você anexou. O ZBOX só mostra — quem gera a nota é a Prefeitura ou o emissor."
4. **Financeiro / Pedidos (lista)**: pedido **ENTREGUE** mostra "NF 1234" ou "Sem nota fiscal" embaixo da situação.

**WhatsApp:** só abre a conversa (`wa.me/55NUMERO?text=...`) com a mensagem pronta — **nunca envia sozinho**.

## 4. Testes (QA)
- E2E: anotar nota → toast → selo "NF 1234" no pedido e no Financeiro.
- Negativos: sem número; data amanhã; arquivo de 6 MB; pedido cancelado; usuário EMPLOYEE não vê os botões.
- `data-testid`: `invoice-card`, `invoice-add`, `invoice-number`, `invoice-date`, `invoice-type`, `invoice-file`, `invoice-save`, `invoice-view-pdf`, `invoice-badge`.
