import { StatusTag } from '../../components/zbox'
import type { StatusTone } from '../../components/zbox/StatusTag'
import { STATUS_LABEL } from './labels'
import type { QuoteStatus } from './types'

const TONE: Record<QuoteStatus, StatusTone> = {
  DRAFT: 'neutral', CONFIRMED: 'brand', SENT: 'info', APPROVED: 'success', REJECTED: 'danger', CANCELED: 'neutral', SUPERSEDED: 'neutral',
}

// Selo de status: sempre com texto (não só cor)
export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <StatusTag tone={TONE[status]}>{STATUS_LABEL[status]}</StatusTag>
}
