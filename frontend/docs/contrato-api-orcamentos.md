# Contrato da API — Orçamentos (HU13 a HU18)

> Versão 1 · proposta do Front (Thayná) para revisão do Back (Inácio).
> O front já usa estes formatos com dados simulados (`src/features/orcamentos/quotesApi.ts`).
> Mudou algo? Atualiza este arquivo **antes** de codar.

## Decisões da PO (04/10)

| Assunto | Decisão |
|---|---|
| Itens | **Digitados** no orçamento (não existe catálogo de produtos) |
| Cobrança do item | **Por unidade** ou **por m²** (largura × altura) |
| Área mínima | **Não existe**: cobra a área exata |
| Validade | **Não existe** (nem status Expirado) |
| Status | Rascunho → Confirmado → Enviado → Aprovado / Recusado · Cancelado · Substituído (versão antiga) |
| Desconto | Opcional, em **%** ou **R$**. Todos os perfis podem dar |
| Aprovar/recusar | Todos os perfis. Registro **manual** (a resposta do cliente chega fora do sistema) |
| WhatsApp | O sistema só **abre** o WhatsApp com a mensagem pronta. Quem envia é o usuário |
| PDF | Cabeçalho com nome, logo, WhatsApp e endereço da empresa (**sem CNPJ**), sem validade, sem assinatura |
| Instalação/mão de obra | Não é cobrada como item |
| Unidade | Um campo só: `un`, `pç`, `conj`, `m`, `kg` ou **m²**. m² = `chargeType: AREA` (pede largura e altura) |
| Desenho no PDF | Escolhido pelo front a partir da descrição (porta, janela, box, portão, grade, espelho, vidro…). **Não muda a API** |

## Regras de dinheiro (o back é a autoridade)

- **Valores em centavos** (inteiro): `R$ 1.500,00` → `150000`.
- **Medidas em centímetros** (inteiro): `1,20 m` → `120`. De 1 a 2000 (0,01 m a 20,00 m).
- No Java: `BigDecimal` (ou `long` em centavos). **Nunca** `double`/`float`.
- **Subtotal do item**
  - `UNIT`: `quantidade × preço`
  - `AREA`: `quantidade × (larguraCm × alturaCm) × preçoPorM² ÷ 10.000`, arredondado em **2 casas, HALF_UP**
- **Desconto**
  - `PERCENT`: `discountValue` em **centésimos de %** (5% = `500`; 12,5% = `1250`), de 0 a 10000. Desconto = `subtotal × valor ÷ 10.000`, HALF_UP.
  - `AMOUNT`: `discountValue` em centavos, de 0 até o subtotal.
- **Total** = subtotal − desconto.
- O request **não tem** subtotal nem total. O back calcula tudo e devolve. A tela calcula ao vivo só para ajudar.

Casos de teste (o front já passa nestes; o back precisa dar o mesmo resultado):

| Entrada | Esperado |
|---|---|
| 2 peças de 120 × 100 cm a 85000/m² | 204000 |
| 1 peça de 50 × 50 cm a 85001/m² (0,25 m² × R$ 850,01 = 212,5025) | 21250 |
| subtotal 354000, desconto 5% (500) | desconto 17700, total 336300 |
| subtotal 100, desconto 12,5% (1250) → 12,5 centavos | 13 (HALF_UP) |
| subtotal 300000, desconto AMOUNT 350000 | **422** `DISCOUNT_GREATER_THAN_SUBTOTAL` |

## Transições de status (validar no back)

| De | Ação | Para |
|---|---|---|
| — | `POST /quotes` | DRAFT |
| DRAFT | `POST /{id}/confirm` | CONFIRMED |
| CONFIRMED | `POST /{id}/back-to-draft` | DRAFT |
| CONFIRMED | 1º `POST /{id}/dispatches` | SENT |
| SENT | `POST /{id}/dispatches` | SENT (só registra no histórico) |
| SENT | `POST /{id}/approve` | APPROVED |
| SENT | `POST /{id}/reject` | REJECTED |
| DRAFT, CONFIRMED, SENT | `POST /{id}/cancel` | CANCELED |
| SENT, REJECTED | `POST /{id}/versions` | versão atual → SUPERSEDED; nova versão → DRAFT |

Qualquer outra → **409** `INVALID_QUOTE_STATUS_TRANSITION`.
`confirm` é **idempotente**: se já está CONFIRMED, devolve 200 com o orçamento (duplo clique não confirma 2 vezes).

## Formato de erro
O mesmo de Clientes/Login: `{ timestamp, status, code, message, path, fieldErrors? }`. O front escolhe a mensagem pelo `code`.

---

## Endpoints

Todos exigem `Authorization: Bearer <token>`.

### `GET /api/quotes`
Query: `search` (número ou nome do cliente, 2+ caracteres), `status` (`DRAFT|CONFIRMED|SENT|APPROVED|REJECTED|CANCELED`, vazio = todos), `period` (`ALL|LAST_30|LAST_90`), `customerId`, `page` (0…), `size` (20).
Lista sempre a **versão atual** de cada orçamento, mais recentes primeiro.

```json
{
  "content": [
    { "id": 6, "number": "000125", "version": 1, "customerName": "Marcos Andrade Silva",
      "createdAt": "2026-10-04T07:00:00Z", "totalCents": 336300, "status": "SENT" }
  ],
  "page": 0, "size": 20, "totalElements": 6, "totalPages": 1
}
```

### `GET /api/quotes/counts`
```json
{ "ALL": 6, "DRAFT": 1, "CONFIRMED": 1, "SENT": 2, "APPROVED": 1, "REJECTED": 1, "CANCELED": 0 }
```

### `POST /api/quotes` → 201
```json
{ "customerId": 9 }
```
Cria **rascunho v1** com o número sequencial (`"000125"`). Erros: 404 `CUSTOMER_NOT_FOUND`, 409 `CUSTOMER_INACTIVE`.

### `GET /api/quotes/{id}?version=n`
Sem `version` → versão atual. Erros: 404 `QUOTE_NOT_FOUND`, 404 `QUOTE_VERSION_NOT_FOUND`.

```json
{
  "id": 6, "number": "000125", "version": 1, "latestVersion": 1, "status": "SENT",
  "customer": { "id": 9, "name": "Marcos Andrade Silva", "whatsapp": "19998125848", "phone": null,
                "addressLine": "Rua das Palmeiras, 108 · Jardim Amanda · Hortolândia/SP" },
  "items": [
    { "id": 31, "description": "Porta pivotante de alumínio", "chargeType": "UNIT", "quantity": 1, "unit": "un",
      "widthCm": null, "heightCm": null, "unitPriceCents": 150000, "areaPerPieceCm2": null, "subtotalCents": 150000 },
    { "id": 32, "description": "Janela de correr 2 folhas", "chargeType": "AREA", "quantity": 2, "unit": null,
      "widthCm": 120, "heightCm": 100, "unitPriceCents": 85000, "areaPerPieceCm2": 12000, "subtotalCents": 204000 }
  ],
  "subtotalCents": 354000, "discountType": "PERCENT", "discountValue": 500, "discountCents": 17700, "totalCents": 336300,
  "paymentTerms": "50% de entrada e 50% na entrega", "notes": "Prazo de fabricação: 15 dias úteis após a aprovação.",
  "versionReason": null,
  "createdAt": "…", "updatedAt": "…", "confirmedAt": "…", "sentAt": "…", "decidedAt": null,
  "approvalMethod": null, "rejectionReason": null, "decisionNote": null,
  "events": [
    { "id": 90, "type": "DISPATCHED", "version": 1, "detail": "WHATSAPP", "userName": "Thayná", "createdAt": "…" }
  ]
}
```

`events[].type`: `CREATED | UPDATED | CONFIRMED | BACK_TO_DRAFT | DISPATCHED | APPROVED | REJECTED | CANCELED | NEW_VERSION | CONVERTED` (vem do AuditLog).

`order`: `null` ou `{ "id": 45, "number": "000045" }` quando o orçamento aprovado já virou pedido (HU19). Conversão: `POST /api/quotes/{id}/convert-to-order`, ver `docs/contrato-api-pedidos-financeiro.md`.

### `PUT /api/quotes/{id}` (só DRAFT)
```json
{
  "items": [
    { "description": "Janela de correr 2 folhas", "chargeType": "AREA", "quantity": 2, "unit": null,
      "widthCm": 120, "heightCm": 100, "unitPriceCents": 85000 }
  ],
  "discountType": "PERCENT", "discountValue": 500,
  "paymentTerms": "50% de entrada e 50% na entrega", "notes": null
}
```
Validações → **400** `VALIDATION_ERROR` com `fieldErrors[].field` no formato `items[1].unitPriceCents`:
descrição 2–200 · quantidade 1–9999 · preço > 0 · medidas 1–2000 (só AREA) · até 100 itens.
Desconto inválido → **422** `DISCOUNT_GREATER_THAN_SUBTOTAL` | `DISCOUNT_PERCENT_OVER_100` | `DISCOUNT_NEGATIVE`.
Não está em rascunho → **409** `QUOTE_NOT_EDITABLE`.

### `POST /api/quotes/{id}/confirm`
Exige ≥ 1 item, total > 0 e cliente ativo. Senão **422** `QUOTE_CANNOT_BE_CONFIRMED` (o `message` diz o motivo).

### `POST /api/quotes/{id}/back-to-draft`
Só CONFIRMED (ainda não enviado).

### `POST /api/quotes/{id}/dispatches`
```json
{ "channel": "WHATSAPP" }
```
`WHATSAPP | PDF | PRINT`. Registra no histórico (quem, quando, versão). O 1º muda CONFIRMED → SENT.

### `POST /api/quotes/{id}/approve`
```json
{ "method": "WHATSAPP" }
```
`WHATSAPP | IN_PERSON | PHONE`. Aprovar **não** registra pagamento.

### `POST /api/quotes/{id}/reject`
```json
{ "reason": "PRICE", "note": "Achou caro, pediu para pensar." }
```
`PRICE | DEADLINE | CHOSE_COMPETITOR | GAVE_UP | OTHER`. `reason` obrigatório.

### `POST /api/quotes/{id}/cancel`
```json
{ "reason": "Cliente desistiu da obra." }
```
`reason` obrigatório (3+ caracteres).

### `POST /api/quotes/{id}/versions`
```json
{ "reason": "Cliente pediu porta maior" }
```
`reason` opcional. Copia os itens, cria `version + 1` em DRAFT e marca a anterior como SUPERSEDED (só leitura).

### `GET /api/quotes/{id}/pdf?version=n` *(recomendado na integração)*
Hoje o **front gera o PDF** (arquivo A4 em `src/features/orcamentos/quotePdf.tsx`) para baixar e para anexar no WhatsApp.
Limitação: o texto vira imagem (não dá para copiar). O ideal é o back gerar o PDF oficial a partir do orçamento confirmado
e devolver `application/pdf` com `Content-Disposition: attachment; filename="Orcamento-000125-v1-Marcos.pdf"`.
Quando existir, o front troca só o corpo de `generateQuotePdf` por um `fetch` deste endpoint.

**Sobre mandar o PDF pelo WhatsApp:** o link `wa.me` só aceita texto. No celular (e no computador com o **app** do WhatsApp)
o front usa o *Compartilhar* do sistema (PDF + mensagem; a pessoa escolhe a conversa e envia). No WhatsApp Web abre a conversa com a mensagem e baixa o PDF para anexar.

**Próximo passo sugerido (precisa do back):** link do PDF na mensagem, ex.: `https://zbox…/o/k7P2xQ`. O back guarda o PDF do orçamento confirmado e cria um token difícil de adivinhar, com validade (LGPD). Assim o cliente abre o PDF com um toque, em qualquer aparelho, sem ninguém anexar nada. Endpoint proposto: `POST /api/quotes/{id}/share-link` → `{ "url": "…", "expiresAt": "…" }` e a rota pública `GET /o/{token}` devolvendo o PDF.
Anexar sozinho só com a API do WhatsApp Business (paga e envia sem revisão), por isso **não** usamos.

---

## Pontos para o Inácio confirmar
1. Centavos/centímetros inteiros na API: ok? (alternativa: `BigDecimal` como string `"1500.00"`)
2. Número do orçamento: sequência global com 6 dígitos (`000125`)? Reinicia por ano?
3. `events` dentro do GET ou endpoint separado `GET /{id}/timeline`?
4. `counts` em endpoint próprio ou junto da listagem?
