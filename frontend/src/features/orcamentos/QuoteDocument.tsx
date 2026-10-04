import mascote from '../../assets/zbox-mascote.webp'
import { COMPANY } from '../../config/company'
import { formatDate, maskPhone } from '../clientes/format'
import { formatAreaM2, formatMeters, formatMoney, formatPercent } from './money'
import { PieceDrawing } from './PieceDrawing'
import type { Quote } from './types'
import './QuoteDocument.css'

// O orçamento "em papel" (opção C aprovada pelo cliente: ficha técnica).
// Usado na REVISÃO (prévia) e na IMPRESSÃO/PDF.
// Os valores vêm prontos do back (subtotal de cada item, desconto, total). Aqui só mostramos.

// `paper`: força o layout A4 mesmo numa tela de celular (usado para gerar o arquivo PDF)
export function QuoteDocument({ quote, paper = false }: { quote: Quote; paper?: boolean }) {
  const contact = [quote.customer.whatsapp ? maskPhone(quote.customer.whatsapp) : quote.customer.phone ? maskPhone(quote.customer.phone) : null, quote.customer.addressLine].filter(Boolean).join(' · ')

  return (
    <article className={paper ? 'qd qd--paper' : 'qd'} aria-label={`Orçamento ${quote.number}`}>
      <div className="qd__frame">
        <header className="qd__header">
          <div className="qd__brand">
            <img src={mascote} alt="" className="qd__mascot" />
            <div className="qd__brand-text">
              <span className="qd__name">{COMPANY.name}</span>
              <span className="qd__tagline">{COMPANY.tagline}</span>
              <span className="qd__contact">{[COMPANY.whatsapp, COMPANY.address, COMPANY.cityState].join(' · ')}</span>
            </div>
          </div>
          <div className="qd__docbox">
            <div className="qd__doctitle">ORÇAMENTO</div>
            <div className="qd__docfield"><span className="qd__label">Número</span><span className="qd__mono">{quote.number}-v{quote.version}</span></div>
            <div className="qd__docfield"><span className="qd__label">Emissão</span><span className="qd__mono">{formatDate(quote.confirmedAt ?? quote.updatedAt)}</span></div>
          </div>
        </header>

        <section className="qd__customer">
          <span className="qd__label qd__label--accent">Cliente</span>
          <div>
            <div className="qd__customer-name">{quote.customer.name}</div>
            {contact && <div className="qd__muted">{contact}</div>}
          </div>
        </section>

        <section className="qd__items">
          <div className="qd__row qd__row--head" aria-hidden="true">
            <span>Item</span><span>Peça</span><span>Descrição e medidas</span><span className="qd__right">Total</span>
          </div>
          {quote.items.map((item, i) => (
            <div key={item.id} className="qd__row">
              <span className="qd__mono qd__accent">{String(i + 1).padStart(2, '0')}</span>
              {/* Mesmo desenho do editor: formato padrão da peça (as medidas já estão escritas ao lado) */}
              <PieceDrawing item={{ ...item, widthCm: null, heightCm: null }} className="qd__drawing" />
              <span className="qd__desc">
                <span className="qd__desc-title">{paper ? noBreakHyphen(item.description) : item.description}</span>
                {item.chargeType === 'AREA' && item.widthCm && item.heightCm ? (
                  <>
                    <span className="qd__mono qd__muted">L {formatMeters(item.widthCm)} m × A {formatMeters(item.heightCm)} m = {formatAreaM2(item.areaPerPieceCm2 ?? 0)} m² · {item.quantity} {item.quantity === 1 ? 'peça' : 'peças'}</span>
                    <span className="qd__mono qd__muted">{formatAreaM2((item.areaPerPieceCm2 ?? 0) * item.quantity)} m² × {formatMoney(item.unitPriceCents)}/m²</span>
                  </>
                ) : (
                  <span className="qd__mono qd__muted">{item.quantity} {item.unit ?? 'un'} × {formatMoney(item.unitPriceCents)}</span>
                )}
              </span>
              <span className="qd__right qd__strong">{formatMoney(item.subtotalCents)}</span>
            </div>
          ))}
        </section>

        <section className="qd__footer">
          <div className="qd__terms">
            {quote.paymentTerms && <div><span className="qd__label qd__label--accent">Pagamento</span><div className="qd__strong">{quote.paymentTerms}</div></div>}
            {quote.notes && <div><span className="qd__label qd__label--accent">Observações</span><div className="qd__notes">{quote.notes}</div></div>}
          </div>
          <div className="qd__totals">
            <div className="qd__total-row"><span>Subtotal</span><span>{formatMoney(quote.subtotalCents)}</span></div>
            {quote.discountCents > 0 && (
              <div className="qd__total-row">
                <span>Desconto{quote.discountType === 'PERCENT' && quote.discountValue ? ` (${formatPercent(quote.discountValue)}%)` : ''}</span>
                <span className="qd__accent">− {formatMoney(quote.discountCents)}</span>
              </div>
            )}
            <div className="qd__final"><span className="qd__label qd__label--light">Valor final</span><span className="qd__final-value">{formatMoney(quote.totalCents)}</span></div>
          </div>
        </section>
      </div>
    </article>
  )
}

// No arquivo PDF a página vira imagem e o hífen comum abria um espaço ("maxim- ar").
// O hífen "inseparável" (U+2011) é desenhado colado.
function noBreakHyphen(text: string): string {
  return text.replace(/-/g, '\u2011')
}
