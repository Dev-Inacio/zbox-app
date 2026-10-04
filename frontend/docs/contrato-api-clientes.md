# Contrato da API — Clientes (HU08 a HU11)

> Versão 1 · proposta do Front (Thayná) para revisão do Back (Inácio).
> Nada aqui é definitivo até o Inácio aprovar. Mudou algo? Atualiza este arquivo **antes** de codar.
> O front já usa exatamente estes formatos com dados simulados (`src/features/clientes/customersApi.ts`).

## Regras de negócio aprovadas pela PO

| Regra | Decisão |
|---|---|
| Campos obrigatórios | **Só o nome** (3 a 120 caracteres) |
| CPF/CNPJ | **Não existe** no cadastro |
| E-mail | **Não existe** no cadastro |
| Busca | A partir de **2 caracteres**, por nome, telefone, WhatsApp ou cidade, sem diferenciar acento/maiúscula |
| Paginação | **20** por página, ordenado por nome |
| Endereço pelo CEP | ViaCEP, chamado direto pelo front |
| Excluir cliente | **Não existe**. Só desativar/reativar |
| Quem desativa/reativa | **ADMIN e MANAGER**. EMPLOYEE recebe 403 |
| Auditoria | Criar, editar, desativar e reativar gravam no AuditLog (usuário + data/hora + campos alterados) |
| Possível duplicado *(sugestão)* | Sem CPF, o aviso é por telefone/WhatsApp iguais. **Só avisa, não bloqueia** |

## Convenções

- Autenticação: `Authorization: Bearer <accessToken>` em todos os endpoints. Sem token → 401.
- Telefone, WhatsApp e CEP trafegam **só com números**: `"19998124410"`, `"13087460"`. A máscara é do front.
- Campo vazio vai como `null` (nunca `""`).
- Datas em ISO 8601 UTC: `"2026-10-04T14:20:00Z"`.
- `type`: `"PERSON"` (pessoa física) | `"COMPANY"` (empresa) | `null`.
- `status`: `"ACTIVE"` | `"INACTIVE"`.
- Erros seguem o formato padrão do ZBOX (o mesmo do login):

```json
{
  "timestamp": "2026-10-04T14:20:00Z",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "Existem campos inválidos.",
  "path": "/api/customers",
  "fieldErrors": [
    { "field": "name", "code": "SIZE", "message": "O nome precisa ter pelo menos 3 letras." }
  ]
}
```

O front decide a mensagem pelo `code`, nunca pelo texto de `message`.

---

## 1. Listar clientes — `GET /api/customers`

| Query | Tipo | Padrão | Observação |
|---|---|---|---|
| `search` | string | — | ignorado se tiver menos de 2 caracteres |
| `status` | `ACTIVE` \| `INACTIVE` \| `ALL` | `ACTIVE` | |
| `type` | `PERSON` \| `COMPANY` | — | omitido = todos |
| `page` | int | `0` | começa em 0 |
| `size` | int | `20` | máximo 100 |

**200 OK**

```json
{
  "content": [
    {
      "id": 9,
      "name": "Marcos Andrade Silva",
      "type": "PERSON",
      "phone": null,
      "whatsapp": "19998125848",
      "city": "Hortolândia",
      "state": "SP",
      "status": "ACTIVE"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 35,
  "totalPages": 2
}
```

Página além do fim → 200 com `content: []` (o front mostra "Esta página não tem clientes").

## 2. Detalhe — `GET /api/customers/{id}`

**200 OK**

```json
{
  "id": 9,
  "name": "Marcos Andrade Silva",
  "type": "PERSON",
  "phone": null,
  "whatsapp": "19998125848",
  "address": {
    "zipCode": "13188000",
    "street": "Rua das Palmeiras",
    "number": "108",
    "complement": null,
    "district": "Jardim Amanda",
    "city": "Hortolândia",
    "state": "SP"
  },
  "notes": "Prefere contato à tarde.",
  "status": "ACTIVE",
  "createdAt": "2026-03-09T15:20:00Z",
  "updatedAt": "2026-03-09T15:20:00Z",
  "deactivatedAt": null,
  "deactivatedBy": null
}
```

**404** `CUSTOMER_NOT_FOUND`

## 3. Cadastrar — `POST /api/customers`

**Request** (só `name` é obrigatório; o resto pode ser `null`)

```json
{
  "name": "Marcos Andrade Silva",
  "type": "PERSON",
  "phone": null,
  "whatsapp": "19998125848",
  "address": {
    "zipCode": "13188000",
    "street": "Rua das Palmeiras",
    "number": "108",
    "complement": null,
    "district": "Jardim Amanda",
    "city": "Hortolândia",
    "state": "SP"
  },
  "notes": null
}
```

**201 Created** com o cliente completo (mesmo formato do detalhe) e header `Location: /api/customers/{id}`.

### Validações do back (a autoridade)

| Campo | Regra | `fieldErrors[].field` |
|---|---|---|
| name | obrigatório, 3 a 120 caracteres (após trim) | `name` |
| phone | `null` ou 10/11 dígitos | `phone` |
| whatsapp | `null` ou 11 dígitos | `whatsapp` |
| address.zipCode | `null` ou 8 dígitos | `address.zipCode` |
| address.state | `null` ou UF válida (2 letras) | `address.state` |
| address.* (texto) | até 120 caracteres; `number` até 20 | `address.street` etc. |
| notes | até 500 caracteres | `notes` |
| type | `null`, `PERSON` ou `COMPANY` | `type` |

Erro → **400** `VALIDATION_ERROR` com `fieldErrors`.

## 4. Editar — `PUT /api/customers/{id}`

Mesmo request do POST. **200 OK** com o cliente atualizado.
Erros: 400 `VALIDATION_ERROR`, 404 `CUSTOMER_NOT_FOUND`.
O back registra no AuditLog **quais campos mudaram** (ver item 7).

## 5. Desativar — `PATCH /api/customers/{id}/deactivate`

Sem corpo. **200 OK** com o cliente (`status: "INACTIVE"`, `deactivatedAt`, `deactivatedBy` preenchidos).

| Status | code | Quando |
|---|---|---|
| 403 | `FORBIDDEN` | perfil EMPLOYEE |
| 404 | `CUSTOMER_NOT_FOUND` | id não existe |
| 409 | `CUSTOMER_ALREADY_INACTIVE` | já estava inativo |

## 6. Reativar — `PATCH /api/customers/{id}/activate`

Igual ao 5, com `409 CUSTOMER_ALREADY_ACTIVE`.

## 7. Histórico — `GET /api/customers/{id}/history`

Vem do AuditLog, mais recente primeiro. **200 OK**

```json
[
  { "id": 31, "action": "UPDATED", "changedFields": ["whatsapp", "address"], "userName": "Inácio", "createdAt": "2026-10-02T12:41:00Z" },
  { "id": 12, "action": "CREATED", "changedFields": [], "userName": "Thayná", "createdAt": "2026-03-09T15:20:00Z" }
]
```

`action`: `CREATED` | `UPDATED` | `DEACTIVATED` | `ACTIVATED`.
`changedFields` usa os nomes do request: `name`, `type`, `phone`, `whatsapp`, `address`, `notes`.
LGPD: o histórico mostra **quais** campos mudaram, não os valores antigos.

## 8. Possível duplicado — `GET /api/customers/duplicates` *(sugestão)*

| Query | Observação |
|---|---|
| `phone` | só números |
| `whatsapp` | só números |
| `excludeId` | na edição, o próprio cliente |

Procura clientes (ativos e inativos) cujo `phone` **ou** `whatsapp` seja igual a qualquer um dos números enviados.
**200 OK**: lista no formato do item da listagem (pode ser `[]`).
O front chama antes de salvar e, se vier algo, pergunta "Salvar mesmo assim?". O POST/PUT **não** bloqueia por duplicidade.

---

## Pontos para o Inácio confirmar

1. Paginação no formato acima (`content/page/size/totalElements/totalPages`) ou o `Page` padrão do Spring? Se for o padrão, o front adapta em um lugar só.
2. Telefone e CEP salvos só com números: ok?
3. O endpoint de duplicados (item 8) faz sentido ou prefere outra forma?
4. `deactivatedBy` como nome do usuário (texto) ou objeto `{ id, name }`?
