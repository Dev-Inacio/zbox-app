import type { ReactNode } from 'react'
import { usePagedList } from '../../hooks/usePagedList'
import { Pagination } from './Pagination'

// Lista que já veio inteira e é mostrada aos poucos (histórico, abas do cliente…)
export function PagedList<T>({ items, size = 5, noun, render }: { items: T[]; size?: number; noun: string; render: (content: T[]) => ReactNode }) {
  const paged = usePagedList(items, size)
  return (
    <>
      {render(paged.content)}
      {paged.needsPages && <Pagination page={paged.page} totalPages={paged.totalPages} size={paged.size} total={paged.total} shown={paged.content.length} noun={noun} onChange={paged.setPage} />}
    </>
  )
}
