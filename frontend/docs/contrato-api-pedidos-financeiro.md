# Contrato da API — Pedidos e Financeiro (HU19 a HU25)

> Versão 1 · proposta do Front (Thayná) para revisão do Back (Inácio).
> O front já usa estes formatos com dados simulados (`src/features/pedidos/ordersApi.ts`).
> Mudou algo? Atualiza este arquivo **antes** de codar.

## Decisões da PO (04/10)

| Assunto | Decisão |
|---|---|
| Andamento do pedido | **Novo → Em produção → Pronto → Entregue** (+ Cancelado). **Sem** "Em instalação" |
| Prazo de entrega | **Não existe** (revisado 04/10). Não há pedido "atrasado" na operação |
| Pagamento do pedido | **Não pago → Parcial → Pago**, e **Pagamento atrasado** |
| Pagamento atrasado | **Sem data de vencimento.** É o pedido **entregue** que ainda tem valor a receber |
| Entrada (sinal) | Perguntada **na hora de converter** o orçamento (opcional: pode ser "não recebeu") |
| Entrega | Pergunta **"O cliente pagou o restante (R$ X)?"** → Sim: registra pagamento → Pago. Não: Pagamento atrasado |
| Cobrança | Botão **Cobrar pelo WhatsApp**: abre o WhatsApp com a mensagem pronta; **quem envia é o usuário**. Fica registrado |

> "Atrasado" só existe no dinheiro: **Pagamento atrasado** = foi entregue e falta receber.

## Regra de ouro do financeiro
Criar pedido, produzir e entregar **não** é receber. Dinheiro só entra em "Recebido" quando existe **pagamento registrado**.

- `paidCents` = soma dos pagamentos **não estornados**.
- `remainingCents` = `totalCents − paidCents`.
- `paymentStatus` (calculado pelo back, nunca enviado pelo front):
  - `PAID` se `remainingCents == 0`
  - senão `OVERDUE` se `status == DELIVERED`
  - senão `PARTIAL` se `paidCents > 0`
  - senão `UNPAID`
- Cancelado: `paymentStatus` continua calculado, mas o pedido sai de "A receber".

## Pagamento: o que o back precisa garantir
- `amountCents` > 0 e **≤ remainingCents** → senão **422** `PAYMENT_EXCEEDS_BALANCE` / `PAYMENT_AMOUNT_INVALID`.
- Pedido cancelado → **409** `ORDER_CANCELED`. Já pago → **409** `ORDER_ALREADY_PAID`.
- **Concorrência** (dois usuários pagando ao mesmo tempo): travar o pedido na transação (`SELECT … FOR UPDATE` ou `@Version` + retry). Nunca terminar com recebido > total.
- **Duplo clique**: o front manda o header `Idempotency-Key: <uuid>` em `POST /payments`. Mesmo key → devolve o mesmo pagamento, sem criar outro.
- Data do pagamento (`paidAt`): não pode ser no futuro → **422** `PAYMENT_DATE_IN_FUTURE`.
- Pagamento errado não é apagado: é **estornado** (ADMIN/MANAGER, motivo obrigatório). Fica no histórico.

## Transições do andamento (validar no back)

| De | Ação | Para |
|---|---|---|
| — | `POST /quotes/{id}/convert-to-order` | NEW |
| NEW | `POST /orders/{id}/status` `IN_PRODUCTION` | IN_PRODUCTION |
| IN_PRODUCTION | `POST /orders/{id}/status` `READY` | READY |
| READY | `POST /orders/{id}/deliver` | DELIVERED |
| IN_PRODUCTION | `POST /orders/{id}/status` `NEW` (voltar etapa) | NEW |
| READY | `POST /orders/{id}/status` `IN_PRODUCTION` (voltar etapa) | IN_PRODUCTION |
| NEW, IN_PRODUCTION, READY | `POST /orders/{id}/cancel` | CANCELED |

Outra qualquer → **409** `INVALID_ORDER_STATUS_TRANSITION`. `DELIVERED` e `CANCELED` não mudam mais de andamento (pagamentos continuam podendo ser registrados no entregue).

## Formato de erro
O mesmo de Clientes/Orçamentos: `{ timestamp, status, code, message, path, fieldErrors? }`.

---

## Endpoints

Todos exigem `Authorization: Bearer <token>`. Valores em **centavos** (inteiro), datas `YYYY-MM-DD`, data-hora ISO 8601 UTC.

### `POST /api/quotes/{id}/convert-to-order` → 201 (Order)
```json
{
  "downPayment": { "amountCents": 168150, "method": "PIX", "paidAt": "2026-10-04" }
}
```
`downPayment` é opcional (`null` = não recebeu entrada).
Erros: 409 `QUOTE_NOT_APPROVED`, 409 `QUOTE_ALREADY_CONVERTED` (devolve `orderId` no `message`/detalhe), 422 `PAYMENT_EXCEEDS_BALANCE`.
Os itens e valores do orçamento aprovado são **copiados** para o pedido (o orçamento continua existindo, e o pedido guarda `quoteId` + `quoteVersion`).

### `GET /api/orders`
Query: `search` (número, nome do cliente; 2+ caracteres), `status` (`NEW|IN_PRODUCTION|READY|DELIVERED|CANCELED`, vazio = todos), `payment` (`UNPAID|PARTIAL|PAID|OVERDUE`), `customerId`, `page`, `size` (20).
Ordem: em andamento primeiro, **os mais antigos no topo** (esperando há mais tempo); entregues/cancelados por data de entrega/cancelamento (mais recentes primeiro).

```json
{
  "content": [
    { "id": 45, "number": "000045", "customerName": "Marcos Andrade Silva", "createdAt": "2026-10-04T15:45:00Z",
      "status": "IN_PRODUCTION", "paymentStatus": "PARTIAL",
      "totalCents": 336300, "paidCents": 168150, "remainingCents": 168150, "deliveredAt": null }
  ],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1
}
```

### `GET /api/orders/counts`
```json
{ "ALL": 7, "NEW": 1, "IN_PRODUCTION": 2, "READY": 1, "DELIVERED": 3, "CANCELED": 0, "OVERDUE_PAYMENT": 2 }
```

### `GET /api/orders/{id}`
```json
{
  "id": 45, "number": "000045", "status": "IN_PRODUCTION", "paymentStatus": "PARTIAL",
  "quote": { "id": 6, "number": "000125", "version": 1 },
  "customer": { "id": 9, "name": "Marcos Andrade Silva", "whatsapp": "19998125848", "phone": null,
                "addressLine": "Rua das Palmeiras, 108 · Jardim Amanda · Hortolândia/SP" },
  "items": [ { "id": 1, "description": "Janela de correr 2 folhas", "chargeType": "AREA", "quantity": 2, "unit": null,
               "widthCm": 120, "heightCm": 100, "unitPriceCents": 85000, "areaPerPieceCm2": 12000, "subtotalCents": 204000 } ],
  "subtotalCents": 354000, "discountCents": 17700, "totalCents": 336300,
  "paidCents": 168150, "remainingCents": 168150,
  "paymentTerms": "50% de entrada e 50% na entrega", "notes": null,
  "createdAt": "…", "deliveredAt": null, "deliveredOn": null, "receivedBy": null, "deliveryNote": null,
  "canceledAt": null, "cancelReason": null,
  "payments": [
    { "id": 301, "amountCents": 168150, "method": "PIX", "paidAt": "2026-10-04", "note": "Entrada",
      "userName": "Thayná", "createdAt": "…", "reversed": false, "reversedReason": null }
  ],
  "lastCollectionAt": null,
  "events": [ { "id": 1, "type": "CREATED", "detail": null, "userName": "Thayná", "createdAt": "…" } ]
}
```
`events[].type`: `CREATED | STATUS_CHANGED | DELIVERED | PAYMENT | PAYMENT_REVERSED | COLLECTION | CANCELED` (vem do AuditLog). `detail` traz o texto curto (ex.: `"NEW→IN_PRODUCTION"`, `"PIX 1681,50"`).

### `POST /api/orders/{id}/status`
```json
{ "status": "IN_PRODUCTION", "note": null }
```

### `POST /api/orders/{id}/deliver`
```json
{
  "deliveredOn": "2026-10-18", "receivedBy": "Marcos", "note": null,
  "payment": { "amountCents": 168150, "method": "PIX", "paidAt": "2026-10-18" }
}
```
Só READY. `payment` = `null` quando a resposta foi "Não, ainda vai pagar" (→ `OVERDUE`). Se vier, tem que ser **exatamente** o `remainingCents` (senão 422 `PAYMENT_MUST_SETTLE_BALANCE`; pagamento parcial na entrega = registrar em `/payments` antes). Tudo na **mesma transação**.
`receivedBy` 2–120 caracteres. `deliveredOn` não pode ser no futuro.

### `POST /api/orders/{id}/payments` → 201 (Order atualizado)
Header `Idempotency-Key`.
```json
{ "amountCents": 100000, "method": "PIX", "paidAt": "2026-10-04", "note": null }
```
`method`: `PIX | CASH | CARD | TRANSFER | BOLETO | OTHER`.

### `POST /api/orders/{id}/payments/{paymentId}/reverse` (ADMIN, MANAGER)
```json
{ "reason": "Lançado no pedido errado" }
```
403 para EMPLOYEE.

### `POST /api/orders/{id}/collections`
```json
{ "channel": "WHATSAPP" }
```
Registra que o usuário **abriu** a cobrança no WhatsApp (o envio é dele). Atualiza `lastCollectionAt`.

### `POST /api/orders/{id}/cancel`
```json
{ "reason": "Cliente desistiu" }
```
Se já houve pagamento, o pedido cancela mesmo assim e os pagamentos ficam registrados (devolução de dinheiro fica fora do sistema por enquanto — **ponto para decidir**).

---

## Financeiro

### `GET /api/financial/summary?from=2026-10-01&to=2026-10-31`
```json
{
  "receivableCents": 1840000, "receivableOrders": 6,
  "overdueCents": 520000, "overdueOrders": 2,
  "receivedCents": 960000, "receivedPayments": 7,
  "byMethod": [ { "method": "PIX", "amountCents": 700000 }, { "method": "CASH", "amountCents": 260000 } ]
}
```
`receivable*` = pedidos não cancelados com `remainingCents > 0` (independe do período). `received*` e `byMethod` = pagamentos não estornados com `paidAt` no período.

### `GET /api/financial/receivables`
Query: `filter` (`ALL | OVERDUE | OPEN` — OPEN = ainda não entregue), `search`, `page`, `size`.
Ordem: pagamento atrasado primeiro (entregue há mais tempo no topo), depois os não entregues, mais antigos primeiro.
```json
{
  "content": [
    { "orderId": 41, "number": "000041", "customerName": "Clínica Bem Viver", "customerWhatsapp": "19998004455",
      "status": "DELIVERED", "paymentStatus": "OVERDUE", "createdAt": "2026-08-15T12:00:00Z",
      "totalCents": 420000, "paidCents": 210000, "remainingCents": 210000,
      "deliveredOn": "2026-08-30", "daysSinceDelivery": 35, "lastCollectionAt": "2026-09-12T13:00:00Z" }
  ],
  "page": 0, "size": 20, "totalElements": 6, "totalPages": 1
}
```

### `GET /api/financial/payments?from&to&page&size`
Pagamentos recebidos no período (não estornados), mais recentes primeiro:
```json
{ "content": [ { "id": 301, "orderId": 45, "orderNumber": "000045", "customerName": "Marcos Andrade Silva",
                 "amountCents": 168150, "method": "PIX", "paidAt": "2026-10-04", "userName": "Thayná" } ],
  "page": 0, "size": 20, "totalElements": 7, "totalPages": 1 }
```

### `GET /api/dashboard` (Início)
```json
{
  "quotesAwaitingAnswer": 2, "quotesToSend": 1,
  "ordersNew": 1, "ordersInProduction": 2, "ordersReady": 1,
  "receivableCents": 1840000, "receivableOrders": 6,
  "unpaid": [ { "orderId": 41, "number": "000041", "customerName": "Clínica Bem Viver", "remainingCents": 210000, "daysSinceDelivery": 35 } ],
  "inProgress": [ { "orderId": 45, "number": "000045", "customerName": "Marcos Andrade Silva", "createdOn": "2026-10-04", "status": "IN_PRODUCTION", "daysOpen": 0 } ]
}
```
`unpaid` = até 5, pagamento atrasado, mais antigo primeiro. `inProgress` = até 5 não entregues, os mais antigos primeiro.

---

## Pontos para o Inácio confirmar
1. Número do pedido: sequência própria (`000045`) ou reaproveitar o número do orçamento?
2. Travamento do pagamento: `SELECT … FOR UPDATE` no pedido ou `@Version` com retry?
3. `Idempotency-Key`: guardar por quanto tempo? (sugestão: 24 h)
4. Pedido cancelado com pagamento: só registra ou precisamos de "devolução"? (decisão da PO depois)
5. `GET /api/dashboard` num endpoint só (recomendado: 1 chamada na tela inicial) ou o front junta `counts` + `summary`?
