import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { getCompany } from '../empresa/companyApi'
import { QuoteDocument } from './QuoteDocument'
import type { Quote } from './types'

// Gera o PDF do orçamento como ARQUIVO (para anexar no WhatsApp ou baixar).
// Desenha o mesmo QuoteDocument da impressão numa área escondida, tira uma "foto" e põe numa folha A4.
//
// Limitação conhecida: o texto do PDF vira imagem (não dá para selecionar/copiar).
// Quando o back tiver GET /api/quotes/{id}/pdf, basta trocar o corpo desta função por um fetch
// que devolve o mesmo File. Quem chama não muda.

const A4_WIDTH_PX = 794 // 210 mm a 96 dpi

export function quotePdfFileName(quote: Quote): string {
  const firstName = quote.customer.name.split(' ')[0].normalize('NFD').replace(/[^A-Za-z0-9]/g, '')
  return `Orcamento-${quote.number}-v${quote.version}${firstName ? `-${firstName}` : ''}.pdf`
}

export async function generateQuotePdf(quote: Quote): Promise<File> {
  // As bibliotecas só são baixadas quando alguém gera um PDF (não pesam no carregamento do sistema)
  const [{ default: html2canvas }, { jsPDF }, company] = await Promise.all([import('html2canvas-pro'), import('jspdf'), getCompany()])

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_WIDTH_PX}px;background:#FFFFFF;pointer-events:none;`
  document.body.appendChild(host)
  const root = createRoot(host)

  try {
    flushSync(() => root.render(<QuoteDocument quote={quote} company={company} paper />))
    await document.fonts.ready
    await Promise.all(
      Array.from(host.querySelectorAll('img')).map((img) =>
        img.complete ? Promise.resolve() : new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve() }),
      ),
    )

    const docEl = host.firstElementChild as HTMLElement
    // Onde dá para virar a página sem cortar nada: no fim de cada item e antes do quadro de totais
    const top = docEl.getBoundingClientRect().top
    const cutsCss = [
      ...Array.from(docEl.querySelectorAll('.qd__row:not(.qd__row--head)')).map((el) => el.getBoundingClientRect().bottom - top),
      ...Array.from(docEl.querySelectorAll('.qd__footer')).map((el) => el.getBoundingClientRect().top - top),
    ]

    const canvas = await html2canvas(docEl, { scale: 2, backgroundColor: '#FFFFFF', logging: false })
    const cssToCanvas = canvas.height / docEl.offsetHeight
    const cuts = cutsCss.map((c) => Math.round(c * cssToCanvas)).sort((a, b) => a - b)

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
    const margin = 10
    const pageW = 210 - margin * 2
    const pageH = 297 - margin * 2
    const pxPerMm = canvas.width / pageW
    const pageHeightPx = Math.floor(pageH * pxPerMm)

    // Orçamento comprido: divide em páginas, sempre entre um item e outro
    let start = 0
    let page = 0
    while (start < canvas.height - 8) {
      let end = Math.min(canvas.height, start + pageHeightPx)
      if (end < canvas.height) {
        const best = cuts.filter((c) => c > start + 40 && c <= end).pop()
        if (best) end = best
      }
      const sliceH = end - start
      const slice = document.createElement('canvas')
      slice.width = canvas.width
      slice.height = sliceH
      slice.getContext('2d')?.drawImage(canvas, 0, start, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
      if (page > 0) pdf.addPage()
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, pageW, sliceH / pxPerMm)
      start = end
      page++
    }

    pdf.setProperties({ title: `Orçamento ${quote.number}-v${quote.version}`, subject: quote.customer.name })
    return new File([pdf.output('blob')], quotePdfFileName(quote), { type: 'application/pdf' })
  } finally {
    root.unmount()
    host.remove()
  }
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// O navegador consegue abrir o "Compartilhar" do sistema com um arquivo? (celular, Windows, Mac)
export function canShareFiles(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

// Celular/tablet com "Compartilhar" → é o caminho principal para mandar o PDF direto no WhatsApp
export function canSharePdf(file: File): boolean {
  const touch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  return touch && canShareFiles(file)
}
