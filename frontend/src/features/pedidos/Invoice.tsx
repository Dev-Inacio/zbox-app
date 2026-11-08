import { useEffect, useState } from 'react'
import { Download, FileText, MessageCircle, Pencil, Plus, Printer } from 'lucide-react'
import { Alert } from '../../components/ui/Alert'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useCustomerWhatsapp } from '../../hooks/useCustomerWhatsapp'
import { ApiError } from '../auth/types'
import { formatDateTime, onlyDigits } from '../clientes/format'
import { canShareFiles, downloadFile } from '../orcamentos/quotePdf'
import { formatDay, todayIso } from './dates'
import { getInvoiceFile, saveInvoice, uploadInvoiceFile } from './ordersApi'
import type { InvoiceType, Order } from './types'
import './Invoice.css'

// HU29: o ZBOX não emite nota. Só guarda o número (e o arquivo, opcional) da nota emitida fora.

const TYPE_LABEL: Record<InvoiceType, string> = { SERVICE: 'Serviço (NFS-e)', PRODUCT: 'Produto (NF-e)', BOTH: 'As duas' }
const MAX_FILE_BYTES = 5 * 1024 * 1024
const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

// Nota fiscal desligada por enquanto: mude para true para voltar a aparecer no sistema
export const INVOICE_ENABLED = false

// "NF 1234" ou "Sem nota fiscal": selo das listas e do título do pedido
export function InvoiceTag({ number }: { number: string | null }) {
  if (!INVOICE_ENABLED) return null
  return number
    ? <span className="inv-tag" data-testid="invoice-badge"><FileText size={16} strokeWidth={1.8} aria-hidden="true" />NF {number}</span>
    : <span className="inv-tag inv-tag--none">Sem nota fiscal</span>
}

function useInvoiceWhatsapp(order: Order) {
  const { registered } = useCustomerWhatsapp(order.customer.id, order.customer.whatsapp)
  const [note, setNote] = useState<string | null>(null)
  const number = order.invoice?.number
  const hasFile = order.invoice?.hasFile ?? false
  const updatedAt = order.invoice?.updatedAt
  // Busca o arquivo antes do clique: o navegador só libera o Compartilhar logo depois do clique.
  // "updatedAt" faz buscar de novo quando a nota é corrigida e o arquivo é trocado.
  const [file, setFile] = useState<File | null>(null)
  useEffect(() => {
    let active = true
    if (hasFile) getInvoiceFile(order.id).then((f) => { if (active) setFile(f) }).catch(() => {})
    return () => { active = false }
  }, [order.id, hasFile, updatedAt])

  async function send() {
    if (!number) return
    const text = `Olá, ${order.customer.name.split(' ')[0]}! Segue a nota fiscal nº ${number} do pedido nº ${order.number}.`
    setNote(null)
    const current = file ?? await getInvoiceFile(order.id).catch(() => null)
    if (!current) { setNote('O arquivo não está mais disponível. Use "Corrigir" para anexar o PDF de novo.'); return }
    // O Compartilhar do aparelho manda o arquivo e a mensagem juntos
    if (canShareFiles(current)) {
      void navigator.clipboard?.writeText(text).catch(() => {})
      try {
        await navigator.share({ files: [current], text })
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    // O link do WhatsApp só aceita texto: abre a conversa e baixa o arquivo para anexar
    downloadFile(current)
    if (!registered) { setNote('Arquivo baixado. O cliente não tem WhatsApp cadastrado.'); return }
    window.open(`https://wa.me/55${onlyDigits(registered)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    setNote('Arquivo baixado. Anexe na conversa (clipe ou arraste) e envie.')
  }
  return { send, note }
}

export function InvoiceCard({ order, canEdit, onEdit, onView }: { order: Order; canEdit: boolean; onEdit: () => void; onView: () => void }) {
  const invoice = order.invoice
  const whatsapp = useInvoiceWhatsapp(order)
  if (!invoice && order.status === 'CANCELED') return null
  return (
    <section className="zv-card zv-card--side zv-card--tight" aria-labelledby="t-nota" data-testid="invoice-card">
      <h2 id="t-nota" className="zv-h2">Nota fiscal</h2>
      {!invoice ? (
        <>
          <InvoiceTag number={null} />
          <p className="zv-sub">O sistema não emite a nota. Anote aqui o número da nota que você emitiu.</p>
          {canEdit && <button type="button" className="zv-btn zv-btn--full" onClick={onEdit} data-testid="invoice-add"><Plus size={20} strokeWidth={1.8} aria-hidden="true" />Anotar nota fiscal</button>}
        </>
      ) : (
        <>
          <div className="zv-line"><span>Número</span><b>{invoice.number}</b></div>
          <div className="zv-line"><span>Data</span><b>{formatDay(invoice.issuedAt)}</b></div>
          <div className="zv-line"><span>Tipo</span><b>{TYPE_LABEL[invoice.type]}</b></div>
          {invoice.notes && <p className="zv-sub">{invoice.notes}</p>}
          <p className="zv-sub">Anotada por {invoice.updatedBy} em {formatDateTime(invoice.updatedAt)}</p>
          {invoice.hasFile && <button type="button" className="zv-btn zv-btn--full" onClick={onView} data-testid="invoice-view-pdf"><FileText size={20} strokeWidth={1.8} aria-hidden="true" />Ver PDF da nota</button>}
          {canEdit && <button type="button" className="zv-btn zv-btn--full" onClick={onEdit} data-testid="invoice-edit"><Pencil size={20} strokeWidth={1.8} aria-hidden="true" />Corrigir</button>}
          {invoice.hasFile
            ? <button type="button" className="zv-btn zv-btn--full" onClick={() => void whatsapp.send()} data-testid="invoice-whatsapp"><MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" />Enviar nota pelo WhatsApp</button>
            : canEdit
              ? <button type="button" className="zv-btn zv-btn--full" onClick={onEdit} data-testid="invoice-attach"><Plus size={20} strokeWidth={1.8} aria-hidden="true" />Anexar PDF para enviar</button>
              : <p className="zv-sub">Esta nota ainda não tem PDF. Peça a um gerente ou administrador para anexar.</p>}
          {whatsapp.note && <p className="zv-sub" role="status">{whatsapp.note}</p>}
        </>
      )}
    </section>
  )
}

export function InvoiceDialog({ order, onCancel, onDone }: { order: Order; onCancel: () => void; onDone: (updated: Order, number: string) => void }) {
  const today = todayIso()
  const current = order.invoice
  const [number, setNumber] = useState(current?.number ?? '')
  const [issuedAt, setIssuedAt] = useState(current?.issuedAt ?? today)
  const [type, setType] = useState<InvoiceType>(current?.type ?? 'SERVICE')
  const [notes, setNotes] = useState(current?.notes ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | null>(null)

  function validate() {
    const e: Record<string, string> = {}
    if (!number.trim()) e.number = 'Informe o número da nota.'
    if (!issuedAt) e.issuedAt = 'Informe a data da nota.'
    else if (issuedAt > today) e.issuedAt = 'A data da nota não pode ser no futuro.'
    if (notes.length > 300) e.notes = 'Máximo de 300 caracteres.'
    if (file && (!FILE_TYPES.includes(file.type) || file.size > MAX_FILE_BYTES)) e.file = 'Envie um PDF ou foto de até 5 MB.'
    return e
  }

  async function submit() {
    if (busy) return
    const e = validate()
    setErrors(e)
    setGeneral(null)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      let updated = await saveInvoice(order.id, { number: number.trim(), issuedAt, type, notes: notes.trim() || null })
      if (file) updated = await uploadInvoiceFile(order.id, file)
      onDone(updated, number.trim())
    } catch (err) {
      setBusy(false)
      if (err instanceof ApiError && err.fieldErrors.length) setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.field, f.message])))
      else setGeneral(err instanceof ApiError ? err.message : 'Não foi possível salvar. Verifique sua conexão e tente de novo.')
    }
  }

  return (
    <ConfirmDialog open title={current ? 'Corrigir nota fiscal' : 'Anotar nota fiscal'} confirmLabel="Salvar nota fiscal" loading={busy} loadingText="Salvando…" onCancel={onCancel} onConfirm={() => void submit()}>
      <div className="oc-dialog-fields">
        <p className="oc-small cl-muted">Pedido nº {order.number} · {order.customer.name}</p>
        <label className="cl-field">
          <span className="cl-field__label">Número da nota</span>
          <input autoComplete="off" className="cl-input" maxLength={20} value={number} onChange={(e) => setNumber(e.target.value)} aria-invalid={errors.number ? true : undefined} data-testid="invoice-number" />
          {errors.number && <span className="field__error">{errors.number}</span>}
        </label>
        <label className="cl-field">
          <span className="cl-field__label">Data da nota</span>
          <input autoComplete="off" className="cl-input" type="date" max={today} value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} aria-invalid={errors.issuedAt ? true : undefined} data-testid="invoice-date" />
          {errors.issuedAt && <span className="field__error">{errors.issuedAt}</span>}
        </label>
        <fieldset className="inv-types" data-testid="invoice-type">
          <legend className="cl-field__label">Tipo da nota</legend>
          {(Object.keys(TYPE_LABEL) as InvoiceType[]).map((t) => (
            <label key={t} className="inv-type">
              <input type="radio" name="tipo-nota" checked={type === t} onChange={() => setType(t)} />
              {TYPE_LABEL[t]}
            </label>
          ))}
        </fieldset>
        <label className="cl-field">
          <span className="cl-field__label">Arquivo da nota (opcional)</span>
          <input className="cl-input inv-file" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="invoice-file" />
          {errors.file
            ? <span className="field__error">{errors.file}</span>
            : <span className="cl-field__hint">{current?.hasFile && !file ? 'Já tem um arquivo. Escolha outro só para trocar.' : 'PDF ou foto, até 5 MB.'}</span>}
        </label>
        <label className="cl-field">
          <span className="cl-field__label">Observação (opcional)</span>
          <textarea autoComplete="off" className="cl-input cl-textarea" rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {errors.notes && <span className="field__error">{errors.notes}</span>}
        </label>
        {general && <Alert variant="error">{general}</Alert>}
      </div>
    </ConfirmDialog>
  )
}

export function InvoiceFileDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const [file, setFile] = useState<{ url: string; name: string; isPdf: boolean } | null>(null)
  const [missing, setMissing] = useState(false)
  const whatsapp = useInvoiceWhatsapp(order)

  useEffect(() => {
    let url: string | null = null
    let active = true
    getInvoiceFile(order.id).then((f) => {
      if (!active) return
      if (!f) { setMissing(true); return }
      url = URL.createObjectURL(f)
      setFile({ url, name: f.name, isPdf: f.type === 'application/pdf' })
    }).catch(() => { if (active) setMissing(true) })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [order.id])

  return (
    <ConfirmDialog open title={`Nota fiscal ${order.invoice?.number ?? ''}`} confirmLabel="Fechar" hideCancel onCancel={onClose} onConfirm={onClose}>
      <div className="inv-view">
        <p className="oc-small cl-muted">Este é o arquivo que você anexou. O sistema só mostra: quem gera a nota é a Prefeitura ou o emissor.</p>
        {missing && <Alert variant="warning">O arquivo não está mais disponível. Use "Corrigir" para enviar de novo.</Alert>}
        {file && (file.isPdf
          ? <iframe id="inv-frame" className="inv-view__doc" src={file.url} title={`Nota fiscal ${order.invoice?.number ?? ''}`} />
          : <img className="inv-view__doc" src={file.url} alt={`Nota fiscal ${order.invoice?.number ?? ''}`} />)}
        {file && (
          <div className="inv-view__actions">
            <a className="zv-btn zv-btn--sm" href={file.url} download={file.name}><Download size={20} strokeWidth={1.8} aria-hidden="true" />Baixar</a>
            <button type="button" className="zv-btn zv-btn--sm" onClick={() => window.open(file.url, '_blank', 'noopener')}><Printer size={20} strokeWidth={1.8} aria-hidden="true" />Abrir para imprimir</button>
            <button type="button" className="zv-btn zv-btn--sm" onClick={() => void whatsapp.send()}><MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" />Enviar pelo WhatsApp</button>
          </div>
        )}
        {whatsapp.note && <p className="oc-small cl-muted" role="status">{whatsapp.note}</p>}
      </div>
    </ConfirmDialog>
  )
}
