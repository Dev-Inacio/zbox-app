import logo from '../../assets/zbox-logo-claro.png'
import { companyAddressLine } from '../empresa/format'
import type { Company } from '../empresa/types'
import { customerMobile, formatDate, maskPhone } from '../clientes/format'
import { formatAreaM2, formatMeters, formatMoney, formatPercent, itemPriceText } from './money'
import { PieceDrawing } from '../../components/zbox'
import { suggestPieceType } from './pieceKind'
import type { Quote } from './types'
import './QuoteDocument.css'

// O orçamento "em papel" (opção C aprovada pelo cliente: ficha técnica).
// Usado na REVISÃO (prévia) e na IMPRESSÃO/PDF.
// Os valores vêm prontos do back (subtotal de cada item, desconto, total). Aqui só mostramos.

// `paper`: força o layout A4 mesmo numa tela de celular (usado para gerar o arquivo PDF)
// `company`: dados da empresa do Perfil (HU26), vindos de GET /api/company
export function QuoteDocument({ quote, company, paper = false }: { quote: Quote; company: Company; paper?: boolean }) {
  const mobile = customerMobile(quote.customer)
  const contact = [mobile ? maskPhone(mobile) : null, quote.customer.addressLine].filter(Boolean).join(' · ')

  return (
    <article className={paper ? 'qd qd--paper' : 'qd'} aria-label={`Orçamento ${quote.number}`}>
      <div className="qd__frame">
        <header className="qd__header">
          <CompanyBrand company={company} />
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
              {/* Mesmo desenho do editor (as medidas já estão escritas ao lado) */}
              <PieceDrawing type={item.pieceType ?? suggestPieceType(item.description)} size={96} className="qd__drawing" />
              <span className="qd__desc">
                <span className="qd__desc-title">{paper ? noBreakHyphen(item.description) : item.description}</span>
                {item.details && <span className="qd__details">{paper ? noBreakHyphen(item.details) : item.details}</span>}
                {item.chargeType === 'AREA' && item.widthCm && item.heightCm ? (
                  <>
                    <span className="qd__mono qd__muted">L {formatMeters(item.widthCm)} m × A {formatMeters(item.heightCm)} m = {formatAreaM2(item.areaPerPieceCm2 ?? 0)} m² · {item.quantity} {item.quantity === 1 ? 'peça' : 'peças'}</span>
                    <span className="qd__mono qd__muted">{formatAreaM2((item.areaPerPieceCm2 ?? 0) * item.quantity)} m² × {formatMoney(item.unitPriceCents)}/m²</span>
                  </>
                ) : (
                  <>
                    {item.widthCm && item.heightCm && <span className="qd__mono qd__muted">Medida: L {formatMeters(item.widthCm)} m × A {formatMeters(item.heightCm)} m</span>}
                    <span className="qd__mono qd__muted">{itemPriceText(item)}</span>
                  </>
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

// Marca + dados da empresa no topo do orçamento. Também aparece como prévia no Perfil.
export function CompanyBrand({ company }: { company: Company }) {
  const address = companyAddressLine(company)
  const phones = [company.whatsapp ? maskPhone(company.whatsapp) : null, company.phone ? maskPhone(company.phone) : null].filter(Boolean).join(' · ')
  return (
    <div className="qd__brand">
      {/* A logo já traz o nome e a frase: o texto fica só para leitor de tela */}
      <img src={logo} alt={company.name} className="qd__logo" />
      <div className="qd__brand-text" data-testid="contato-empresa">
        <span className="qd__name">{company.name}</span>
        {phones && (
          <span className="qd__info">
            <span className="qd__info-label">WhatsApp</span>
            <span className="qd__info-value qd__info-value--big">{phones}</span>
          </span>
        )}
        {address && (
          <span className="qd__info">
            <span className="qd__info-label">Endereço</span>
            <span className="qd__info-value">{address}</span>
          </span>
        )}
      </div>
    </div>
  )
}
