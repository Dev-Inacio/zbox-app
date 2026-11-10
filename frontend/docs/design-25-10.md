# ZBOX · Atualização do design (25/10)

O que mudou no design e como levar para o código. Só front — **nenhuma mudança na API** (exceto o item 3, que é uma melhoria futura para o Inácio).

| # | Mudança | Arquivos |
|---|---|---|
| 1 | Ícone **voltar** mais suave (laranja claro) | `IconBadge.tsx` (novo tom `soft-orange`) |
| 2 | Ícones **olho** (senha) e **sair** em cinza claro | `IconBadge.tsx` (novo tom `soft-gray`) |
| 3 | **Paginação** em "Falta lançar o material" e "Como foi cada serviço" | `usePagedList.ts` (novo) + tela do mês |
| 4 | **Atrasado unificado** dentro de "Falta receber" + paginação | `FinancialPage.tsx` |

---

## 1 e 2 · Ícones suaves

Substitua `src/components/ui/IconBadge.tsx` pelo deste pacote. Os tons antigos continuam iguais; só entraram dois novos.

```tsx
// Voltar
<Link to="/orcamentos" className="back-link">
  <IconBadge icon={ChevronLeft} tone="soft-orange" size={26} />
  Voltar para orçamentos
</Link>

// Olho da senha (PasswordInput)
<IconBadge icon={visible ? EyeOff : Eye} tone="soft-gray" size={30} />

// Sair
<IconBadge icon={LogOut} tone="soft-gray" size={28} />
```

O texto do "Voltar" continua `#E9A06E`.

## 3 · Paginação nas listas do mês

Copie `src/hooks/usePagedList.ts`. Na tela do mês (onde estão as duas listas):

```tsx
import { usePagedList } from '../../hooks/usePagedList'
import { Pagination } from '../../components/ui/Pagination'

const missing = usePagedList(report.missingMaterial, 5)   // "Falta lançar o material"
const services = usePagedList(report.orders, 5)           // "Como foi cada serviço"

// Título usa o TOTAL, não a página:
<h3>Falta lançar o material ({missing.total} serviços)</h3>

<ul>{missing.content.map((o) => <MissingRow key={o.orderId} o={o} />)}</ul>
{missing.needsPages && (
  <Pagination page={missing.page} totalPages={missing.totalPages} size={missing.size}
    total={missing.total} shown={missing.content.length} onChange={missing.setPage} />
)}
```

Mesmo bloco para `services`. Regra: **5 por página; com 5 ou menos, a paginação some**.
Os números de cima ("Mês bom", Serviços, Material, Sua mão de obra) continuam vindo do resumo inteiro.

> Para o Inácio (futuro): quando o mês tiver muitos serviços, `/api/financial/month-summary` pode devolver as listas paginadas (`page`, `size`, `totalElements`), igual `receivables`. Aí é só trocar o hook pelos dados da API.

## 4 · "Atrasado" dentro de "Falta receber"

**Antes:** 4 quadros (Entrou · Falta receber · Atrasado · Resumo do mês) e duas listas ("Quem falta pagar" e "Clientes atrasados").
**Agora:** 3 quadros e **uma** lista "Falta receber", com filtros.

### Quadro (troque os dois quadros por este)

```tsx
<button type="button" className="fn-tile fn-tile--button" data-testid="total-a-receber"
  onClick={() => update({ aba: null, filtro: null, pagina: null })}>
  <span className="fn-tile__label"><IconBadge icon={Clock} tone="amber" size={40} />Falta receber</span>
  <span className="fn-tile__value">{formatMoney(s.receivableCents)}</span>
  <span className="fn-tile__hint">{s.receivableOrders === 1 ? '1 pedido em aberto' : `${s.receivableOrders} pedidos em aberto`}</span>

  {s.overdueOrders > 0 && (
    <span className="fn-late-chip" data-testid="total-atrasado">
      <span className="fn-late-chip__dot" aria-hidden="true" />
      {s.overdueOrders === 1 ? '1 atrasado' : `${s.overdueOrders} atrasados`} · {formatMoney(s.overdueCents)}
    </span>
  )}
  <span className="fn-tile__link">Ver quem falta pagar e cobrar</span>
</button>
```

> ⚠️ QA: o `data-testid="total-atrasado"` mudou de lugar (agora é o chip). Se algum teste Playwright clicava no quadro de atrasado, ajuste para clicar em "Falta receber" e depois no filtro **Atrasados**.

### CSS (Financeiro.css)

```css
.fn-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }

.fn-late-chip {
  align-self: flex-start;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  background: #FDECEA; color: #9B1C1C;
  font-size: 14px; font-weight: 700; white-space: nowrap;
}
.fn-late-chip__dot { width: 8px; height: 8px; border-radius: 50%; background: #DC2626; }

/* Celular: Entrou e Falta receber lado a lado, Resumo do mês embaixo ocupando tudo */
@media (max-width: 640px) {
  .fn-tiles { grid-template-columns: 1fr 1fr; }
  .fn-tiles > :last-child { grid-column: 1 / -1; }
  .fn-late-chip { font-size: 12px; }
}
```

Para Funcionário (não vê lucro) ficam só 2 quadros — o `:last-child` não atrapalha, porque aí o último é "Falta receber" ocupando a linha toda; se preferir lado a lado, aplique a regra só quando houver 3 quadros.

### Lista e filtros

```tsx
const FILTERS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'OVERDUE', label: 'Atrasados' },        // era "Pagamento atrasado"
  { value: 'OPEN', label: 'Ainda não entregue' },
]

<h2>Falta receber</h2>   {/* era "Quem falta pagar" / "Clientes atrasados" */}
```

A ordem (atrasados primeiro) e a paginação de 5 já vêm do `listReceivables` — mantenha o `<Pagination>` que você já tem. Ao trocar o filtro, volte para a página 0 (`pagina: null`).

---

## Checklist de QA

- [ ] Voltar: ícone laranja claro, texto `#E9A06E`, contraste ok no fundo escuro.
- [ ] Olho e Sair: cinza claro, foco de teclado visível.
- [ ] Mês com 3 serviços: sem paginação. Com 12: "Mostrando 1–5 de 12", 3 páginas.
- [ ] Lançar material na página 2 e a lista encolher → não fica numa página vazia.
- [ ] Trocar de página **não** muda os números de cima.
- [ ] Sem atrasados: o chip vermelho some.
- [ ] Clicar em "Falta receber" → lista com filtro Todos, atrasados no topo.
- [ ] Filtro Atrasados com 6+ pedidos → paginação aparece; trocar filtro volta à página 1.
- [ ] Celular 390px: Entrou + Falta receber lado a lado, Resumo embaixo, sem rolagem lateral.
