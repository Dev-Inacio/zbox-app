# ZBOX · Design atualizado (25/10 a 31/10) para o código

Tudo que mudou no design, em componentes prontos. **Nenhuma regra muda: os valores vêm do back, o front só mostra.**

## 1. Copiar para o projeto

```
src/components/ui/IconBadge.tsx     ← substitui o seu (tons soft-orange e soft-gray)
src/components/zbox/                ← pasta nova (componentes + zbox.css)
src/hooks/usePagedList.ts           ← paginação local das listas do mês
```

Precisa do `lucide-react` (você já tem). Importe sempre pelo index:

```tsx
import { ItemsCard, MoneySummary, CustomerCard, ActivityList, StatTile,
         FaltaLancarMaterial, AlertChip, CountChip, SeeMore, InfoList, InfoBlock } from '../../components/zbox'
```

> O `money()` da pasta só formata centavos em R$. Se preferir, troque pelo seu `formatMoney`.

---

## 2. Onde usar cada um

| Tela | O que mudou | Componente |
|---|---|---|
| **Pedido · detalhe** | Itens em blocos numerados, sem totais | `ItemsCard` |
| | Pagamento começa com Subtotal / Desconto / Total | `MoneySummary totalLabel="Total do pedido"` |
| | Card Cliente com iniciais, link e blocos | `CustomerCard` |
| | Gastos e lucro **sem material** | `FaltaLancarMaterial` |
| **Orçamento · detalhe** | Itens iguais ao pedido | `ItemsCard versionLabel="Versão v1"` |
| | Card Valores | `MoneySummary big` (label "Total") |
| **Revise antes de confirmar** | Itens + valores | `ItemsCard collapseAfter={Infinity}` + `MoneySummary big` |
| **Cliente · detalhe (HU11)** | Contato + Endereço + Observações → um card "Dados do cliente" | `InfoList` + `InfoBlock` |
| | Histórico com ícones | `ActivityList` |
| **Início** | Destaques com ícone ao lado e link | `StatTile` |
| | "Clientes que ainda não pagaram" e "Em andamento" em blocos | `.zb-blocks` / `.zb-block` + `CountChip` + `AlertChip` |
| | "Recentes" → **"Últimas atividades"** (sem troca de status) | `ActivityList` |
| **Financeiro** | Atrasado dentro de Falta receber, paginação | ver pacote de 25/10 (`AlertChip` substitui o `.fn-late-chip`) |
| **Ícones** | Voltar suave, olho e sair cinza claro | `IconBadge tone="soft-orange" / "soft-gray"` |

---

## 3. Exemplos

### Pedido · detalhe

```tsx
<ItemsCard
  items={order.items.map((it) => ({
    id: it.id,
    description: it.description,
    details: it.details,                                   // null quando não tem medida
    quantityLabel: it.quantityLabel,                       // "1 un", "2,40 m²"
    unitPriceLabel: it.unitPriceLabel,                     // "R$ 850,00 o m²"
    totalCents: it.totalCents,
  }))}
  versionLabel={`Do orçamento #${order.quoteNumber} v${order.quoteVersion}`}
/>

{/* Card Pagamento — no topo, antes de Recebido/barra/Falta receber */}
<MoneySummary
  subtotalCents={order.subtotalCents}
  discountCents={order.discountCents}
  discountLabel={order.discountType === 'PERCENT' ? `${order.discountValue}%` : null}
  totalCents={order.totalCents}
  totalLabel="Total do pedido"
/>

<CustomerCard
  name={order.customer.name}
  phone={order.customer.whatsapp}
  street={`${order.customer.street}, ${order.customer.number} · ${order.customer.district}`}
  cityState={`${order.customer.city}/${order.customer.state}`}
  customerHref={`/clientes/${order.customer.id}`}
  onWhatsApp={openWhatsApp}
/>

{hasMaterial ? <ResumoLucro … /> : <FaltaLancarMaterial totalCents={order.totalCents} onAdd={openMaterialDialog} />}
```

### Cliente · detalhe

```tsx
<section className="zb-card">
  <h2 className="zb-card__title zb-card__title--sm">Dados do cliente</h2>
  <InfoList>
    {c.whatsapp && <InfoBlock icon={Phone} label="Celular"><span className="zb-strong">{c.whatsapp}</span></InfoBlock>}
    {c.street && (
      <InfoBlock icon={MapPin} label="Endereço">
        <span className="zb-strong">{c.street}, {c.number}</span>
        <span className="zb-muted">{c.district} · {c.city}/{c.state} · CEP {c.cep}</span>
      </InfoBlock>
    )}
    {c.notes && <InfoBlock icon={StickyNote} label="Observações">{c.notes}</InfoBlock>}
  </InfoList>
</section>

<ActivityList items={history.map((h) => ({
  id: h.id,
  icon: h.type === 'CREATED' ? UserPlus : Pencil,
  tone: h.type === 'CREATED' ? 'teal' : 'blue',
  title: h.title,                       // "Celular alterado"
  subtitle: `por ${h.userName}`,
  when: h.whenLabel,                    // "02/10 09:41"
}))} />
```

### Início

```tsx
<div className="fn-tiles">{/* grid de 4 colunas que você já tem */}
  <StatTile icon={FileText} tone="red" label="Orçamentos aguardando resposta" value={s.quotesWaiting}
    hint={`+ ${s.quotesToSend} confirmado para enviar`} linkLabel="Ver orçamentos" href="/orcamentos?status=SENT" />
  <StatTile icon={Hammer} tone="brown" label="Pedidos em produção" value={s.inProduction}
    hint={`+ ${s.newOrders} novo para começar`} linkLabel="Ver pedidos" href="/pedidos?status=IN_PRODUCTION" />
  <StatTile icon={Truck} tone="teal" label="Prontos para entregar" value={s.ready}
    hint="aguardando entrega" linkLabel="Ver prontos" href="/pedidos?status=READY" />
  <StatTile icon={Clock} tone="amber" label="A receber" value={money(s.receivableCents)}
    hint={`em ${s.receivableOrders} pedidos`} linkLabel="Ver financeiro" href="/financeiro" testId="total-a-receber"
    extra={s.overdueOrders > 0 && <AlertChip testId="total-atrasado">{s.overdueOrders} atrasados · {money(s.overdueCents)}</AlertChip>} />
</div>

{/* Lista "Clientes que ainda não pagaram" */}
<h2 className="zb-card__title">Clientes que ainda não pagaram <CountChip tone="red">{unpaid.length}</CountChip></h2>
<ul className="zb-blocks">
  {unpaid.map((r) => (
    <li key={r.orderId} className="zb-block">
      … nome, "Pedido #000041",
      <AlertChip>entregue há {r.daysSinceDelivery} dias</AlertChip>
      … Falta R$ / botão Cobrar
    </li>
  ))}
</ul>
```

"Ver todos", "Ver pedidos", "Ver tudo": `<Link to="/financeiro" className="zb-link"><SeeMore>Ver todos</SeeMore></Link>`

---

## 4. Contrato — conferir com o Inácio

- `GET /api/orders/{id}` e `GET /api/quotes/{id}` precisam trazer `subtotalCents`, `discountCents`, `discountType` (`PERCENT`/`FIXED`), `discountValue` e `totalCents` — não só o total.
- Item: `width`/`height` **opcionais**; se vier um, vem o outro; > 0. Sem medida, `details = null`.
- Atividades do Início: filtrar por tipo (pagamento, orçamento, material) — **sem** troca de status de pedido.
- (já no Trello) `month-summary` paginado; `receivables` com `size=5` e atrasados primeiro.

## 5. Checklist de QA

- [ ] Item sem medida: não aparece linha vazia nem "0,00 × 0,00".
- [ ] Pedido com 12 itens: mostra 5 + "Ver mais 7 itens"; abre e fecha; teclado funciona (Enter/Espaço).
- [ ] Revisão: lista sempre completa (sem botão).
- [ ] Sem desconto: a linha "Desconto" some. Total da tela = total do PDF.
- [ ] Total não quebra linha no card estreito do orçamento.
- [ ] Pedido sem material: "Falta lançar o material", sem lucro e sem selo.
- [ ] Cliente sem endereço/observações: o bloco correspondente não aparece.
- [ ] Início: selo "atrasados" some quando não há atrasados; links levam ao filtro certo.
- [ ] "Últimas atividades" não mostra "Pedido em produção".
- [ ] Celular 390px: sem rolagem lateral; blocos de Cliente empilham; botão WhatsApp ocupa a largura.
- [ ] Playwright: `data-testid` usados — `item-linha`, `ver-mais-itens`, `total`, `falta-lancar-material`, `lancar-material`, `total-a-receber`, `total-atrasado`.
