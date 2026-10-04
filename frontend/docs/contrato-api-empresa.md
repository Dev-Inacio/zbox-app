# Contrato da API — Dados da empresa (HU26 · Perfil)

> Versão 1 · proposta do Front (Thayná) para revisão do Back (Inácio).
> O front já usa este formato com dados simulados (`src/features/empresa/companyApi.ts`).

## Decisões da PO (04/10)

| Assunto | Decisão |
|---|---|
| Onde fica | Página **Perfil** → **Dados da empresa** |
| Quem edita | **ADMIN** e **MANAGER**. EMPLOYEE só vê |
| Para que serve | Cabeçalho do **PDF/impressão do orçamento** (nome, WhatsApp, endereço). Sem CNPJ |
| Logo | Continua o mascote da ZBOX (troca de logo fica para depois) |

Existe **uma** empresa só (não é cadastro de várias). O back guarda um registro único.

## `GET /api/company`
Qualquer usuário logado. Resposta 200:
```json
{
  "name": "ZBOX",
  "tagline": "Serralheria e esquadrias",
  "whatsapp": "19998125848",
  "phone": null,
  "address": {
    "cep": "13184000", "street": "Rua das Indústrias", "number": "250", "complement": null,
    "district": "Centro", "city": "Hortolândia", "state": "SP"
  },
  "updatedAt": "2026-10-04T14:00:00Z",
  "updatedBy": "Thayná"
}
```
Antes de alguém preencher, devolve `name: "ZBOX"`, `tagline: "Serralheria e esquadrias"` e o resto `null`.

## `PUT /api/company` (ADMIN, MANAGER)
Mesmo corpo do GET, sem `updatedAt`/`updatedBy`. Resposta 200 com os dados salvos.

Validações → **400** `VALIDATION_ERROR` com `fieldErrors[].field`:
| Campo | Regra |
|---|---|
| `name` | obrigatório, 2 a 60 caracteres |
| `tagline` | opcional, até 60 |
| `whatsapp` | obrigatório, 10 ou 11 dígitos (só números) |
| `phone` | opcional, 10 ou 11 dígitos |
| `address.cep` | opcional, 8 dígitos |
| `address.city` | obrigatório, até 80 |
| `address.state` | obrigatório, UF com 2 letras (ex.: `SP`) |
| demais | opcionais, até 120 |

EMPLOYEE → **403** `FORBIDDEN`. Toda alteração vai para o **AuditLog** (valor anterior e novo).

## Pontos para o Inácio confirmar
1. Uma tabela `company` com uma linha só (id fixo = 1) está ok?
2. O PDF gerado no back (`GET /api/quotes/{id}/pdf`, se fizermos) usa estes mesmos dados.
