# ZBOX · Tudo que mudou no design (25/10 a 31/10)

Pacote único: substitui os zips anteriores (`zbox-design-25-10`, `zbox-design-31-10`, `zbox-desenhos-pecas`).
**Nenhuma regra de negócio vai para o front:** valores vêm do back, o front só mostra.

## 1. Copiar para o projeto

```
src/components/ui/IconBadge.tsx      ← substitui o seu (tons soft-orange e soft-gray)
src/components/zbox/                 ← pasta nova: componentes + zbox.css
src/hooks/usePagedList.ts            ← paginação local (listas do mês)
src/assets/pecas/pieceTypes.ts       ← lista dos 30 tipos de peça
public/pecas/*.svg                   ← 30 desenhos (o mesmo arquivo vai para o PDF no back)
```

```tsx
import { ItemsCard, MoneySummary, CustomerCard, ActivityList, StatTile, FaltaLancarMaterial,
         RecordRow, CountTabs, PieceDrawing, PiecePreview,
         AlertChip, CountChip, Pill, SeeMore, InfoList, InfoBlock, money } from '../../components/zbox'
```

---

## 2. O que mudou, tela por tela

### Ícones
| Onde | Como |
|---|---|
| Voltar | `<IconBadge icon={ChevronLeft} tone="soft-orange" size={26} />` (texto `#E9A06E`) |
| Olho da senha, Sair | `<IconBadge icon={Eye} tone="soft-gray" />` |
| PDF / folha do orçamento | `tone="red"` (violeta só para "Enviado") |

### Início (Dashboard)
- **Destaques** → `StatTile` (ícone ao lado do título + link "Ver …" no pé). No "A receber": `extra={<AlertChip>2 atrasados · R$ 5.200,00</AlertChip>}`.
- **Clientes que ainda não pagaram** → título com `<CountChip tone="red">`, frase "R$ 5.200,00 na rua.", cada linha em `.zb-block` com `<AlertChip>entregue há 35 dias</AlertChip>`.
- **Em andamento** → `<CountChip>` + linhas em `.zb-block`.
- **Recentes → "Últimas atividades"** → `ActivityList`, **só** pagamentos, orçamentos e materiais (sem troca de status de pedido).
- Links "Ver todos / Ver pedidos / Ver tudo" → `<SeeMore>`.

### Financeiro
- **Atrasado unificado em "Falta receber"**: 3 quadros (Entrou · Falta receber · Resumo do mês). No Falta receber: `<AlertChip testId="total-atrasado">`.
- Lista única "Falta receber" com filtros **Todos · Atrasados · Ainda não entregue**, atrasados no topo, **5 por página** (`<Pagination>` que você já tem).
- "Como foi o mês": "Falta lançar o material" e "Como foi cada serviço" com **5 por página** → `usePagedList(lista, 5)`. Os números de cima continuam do mês inteiro.
- CSS dos quadros:
```css
.fn-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 640px) { .fn-tiles { grid-template-columns: 1fr 1fr; } .fn-tiles > :last-child { grid-column: 1 / -1; } }
```

### Cliente · detalhe (HU11)
- **Resumo** → 3 × `StatTile` (Orçamentos, Pedidos, A receber) com "Ver …".
- **Abas** → `CountTabs` + lista `<ul className="zb-blocks">` de `RecordRow`:
```tsx
<CountTabs label="Movimentação do cliente" active={tab} onChange={setTab} tabs={[
  { key: 'quotes', label: 'Orçamentos', count: quotes.length },
  { key: 'orders', label: 'Pedidos', count: orders.length },
  { key: 'payments', label: 'Pagamentos', count: payments.length },
]} />
<ul className="zb-blocks">
  {tab === 'quotes' && quotes.map((q) => (
    <RecordRow key={q.id} href={`/orcamentos/${q.id}`} title={<>Orçamento #{q.number} <span className="zb-muted">v{q.version}</span></>}
      meta={`${q.statusDateLabel} · `} badges={<QuoteStatusBadge status={q.status} />} valueLabel="Total" value={money(q.totalCents)} />
  ))}
  {tab === 'orders' && orders.map((o) => (
    <RecordRow key={o.id} href={`/pedidos/${o.id}`} title={`Pedido #${o.number}`} meta={`criado ${o.createdLabel} · `}
      badges={<><OrderStatusBadge status={o.status} /><PaymentStatusBadge status={o.paymentStatus} /></>}
      valueLabel={o.remainingCents > 0 ? 'Falta receber' : 'Total'} value={money(o.remainingCents > 0 ? o.remainingCents : o.totalCents)} />
  ))}
  {tab === 'payments' && payments.map((p) => (
    <RecordRow key={p.id} title={`Entrada de ${money(p.amountCents)}`} meta={`${p.dateLabel} · pedido #${p.orderNumber} · por ${p.userName} · `}
      badges={<Pill>{p.methodLabel}</Pill>} valueLabel="Recebido" value={`+ ${money(p.amountCents)}`} positive />
  ))}
</ul>
```
- **Contato + Endereço + Observações → um card "Dados do cliente"** com `InfoList` + `InfoBlock` (Phone / MapPin / StickyNote). Bloco sem dado não aparece.
- **Histórico** → `ActivityList` (lápis azul = alteração, pessoa+ verde-água = cadastro).

### Orçamento
- **Editor:** a seção "Condições" virou **só "Observações (opcional)"** — um `<textarea>` com placeholder *"Ex.: forma de pagamento, prazo, cor do alumínio, tipo de vidro…"* e contador `n/1000`. O pagamento é escrito ali.
- **Editor, cada item:** select **"Tipo de peça"** (`PIECE_OPTIONS`) + `<PiecePreview type={item.pieceType} />` embaixo ("Desenho no PDF: Janela boca de lobo").
- **Detalhe e Revisão:** `ItemsCard` (Revisão com `collapseAfter={Infinity}`) + `MoneySummary big` (rótulo "Total").
- **PDF:** coluna "Peça" usa `public/pecas/{pieceType}.svg` (sem tipo → `outra-peca-sob-medida`).

### Pedido · detalhe
- **Itens** → `ItemsCard` (só itens; 5 + "Ver mais N itens"; medida só se tiver).
- **Pagamento** → começa com `<MoneySummary totalLabel="Total do pedido" />`, depois Recebido / barra / Falta receber.
- **Cliente** → `CustomerCard` (iniciais, "Ver cadastro e outros pedidos", Celular e Endereço em blocos).
- **Gastos e lucro sem material** → `FaltaLancarMaterial` (sem lucro e sem selo). Com material: tire a frase "Ainda falta receber…".

---

## 3. Contrato — combinar com o Inácio

| Mudança | Detalhe |
|---|---|
| Totais no pedido/orçamento | `GET /api/orders/{id}` e `GET /api/quotes/{id}` trazem `subtotalCents`, `discountCents`, `discountType` (`PERCENT`/`FIXED`), `discountValue`, `totalCents` |
| Medidas opcionais | `width`/`height` do item podem ser `null`; se vier um, vem o outro; > 0 |
| **Tipo de peça** | `pieceType` (opcional) em `quote_item`, copiado para `order_item` na conversão. Só códigos de `pieceTypes.ts`; outro valor → 400 `INVALID_PIECE_TYPE`. Migration: `piece_type varchar(60) null` |
| Condições → Observações | `paymentTerms` **sai**; fica só `notes` (até 1000). Migration: remover/ignorar a coluna (decidir com o Inácio se migra o texto antigo para `notes`) |
| Financeiro | `overdue*` faz parte de `receivable*`; `receivables?filter=ALL|OVERDUE|OPEN&size=5` com atrasados primeiro |
| Mês | `month-summary` com listas paginadas (já comentado no HU27) |
| Atividades do Início | filtrar por tipo (pagamento, orçamento, material), sem troca de status |

> ⚠️ Pendente PO: Revisão, Detalhe do orçamento e PDF ainda mostram "Pagamento: …" separado. Com só Observações, essa linha some dessas telas.

---

## 4. Checklist de QA

- [ ] `npm run build` sem erro; telas no celular 390px sem rolagem lateral.
- [ ] Voltar suave; olho/sair cinza claro; foco de teclado visível em botões, abas e "Ver mais".
- [ ] Início: selo de atrasados some quando zero; "Últimas atividades" sem "Pedido em produção".
- [ ] Financeiro: 3 quadros; filtro Atrasados com 6+ → paginação; trocar filtro volta à página 1.
- [ ] Mês: 12 serviços → 3 páginas; trocar página não muda os números de cima.
- [ ] Cliente: abas trocam com clique e teclado; contadores batem com a lista; sem pagamento → estado vazio.
- [ ] Item sem medida: sem linha vazia. 12 itens → 5 + "Ver mais 7 itens". Revisão sempre completa.
- [ ] Sem desconto: linha some. Total da tela = total do PDF.
- [ ] Pedido sem material: "Falta lançar o material", sem lucro/selo.
- [ ] Tipo de peça: trocar no select muda o preview; PDF mostra o mesmo desenho; sem tipo → "sob medida".
- [ ] Observações: 1000 caracteres no máximo; aparecem no PDF com quebras de linha.
- [ ] `data-testid`: `item-linha`, `ver-mais-itens`, `total`, `falta-lancar-material`, `lancar-material`, `total-a-receber`, `total-atrasado`.
