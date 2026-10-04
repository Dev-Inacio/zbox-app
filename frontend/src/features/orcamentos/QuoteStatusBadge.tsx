import { STATUS_LABEL } from './labels'
import type { QuoteStatus } from './types'

// Selo de status: sempre com texto (não só cor)
export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <span className={`oc-badge oc-badge--${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>
}
