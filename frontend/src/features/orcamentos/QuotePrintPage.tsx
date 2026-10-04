import { useCallback, useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { useRequest } from '../../hooks/useRequest'
import { QuoteDocument } from './QuoteDocument'
import { getQuote } from './quotesApi'
import './QuotePrint.css'

// HU16 — Impressão e PDF. Página limpa, sem menu: o que aparece aqui é o que sai no papel.
// "Baixar PDF" usa o "Salvar como PDF" do navegador. (Na integração, o back pode gerar o PDF: GET /api/quotes/{id}/pdf)

export function QuotePrintPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const quoteId = Number(id)
  const version = Number(params.get('versao')) || undefined
  const autoPrint = params.get('imprimir') === '1'

  const fetcher = useCallback(() => getQuote(quoteId, version), [quoteId, version])
  const { loading, data, error } = useRequest(`${quoteId}|${version}`, fetcher)

  useEffect(() => {
    if (data) document.title = `Orçamento ${data.number}-v${data.version} · ${data.customer.name}`
    if (data && autoPrint) {
      const t = setTimeout(() => window.print(), 400) // espera as fontes e a imagem
      return () => clearTimeout(t)
    }
  }, [data, autoPrint])

  return (
    <div className="qp">
      <div className="qp__toolbar">
        <Link to={`/orcamentos/${quoteId}`} className="qp__back">← Voltar para o orçamento</Link>
        <Button onClick={() => window.print()} disabled={!data}>Imprimir ou salvar PDF</Button>
      </div>
      <div className="qp__page">
        {loading && <p className="qp__msg" role="status">Carregando…</p>}
        {!loading && Boolean(error) && <p className="qp__msg" role="alert">Não foi possível carregar o orçamento.</p>}
        {data && <QuoteDocument quote={data} />}
      </div>
    </div>
  )
}
