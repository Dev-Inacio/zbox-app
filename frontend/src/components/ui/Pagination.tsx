import { ChevronLeft } from 'lucide-react'
import './Pagination.css'

// Paginação das listas. "page" começa em 0, como no Spring.
type PaginationProps = { page: number; totalPages: number; size: number; total: number; shown: number; noun?: string; onChange: (page: number) => void }

export function Pagination({ page, totalPages, size, total, shown, noun, onChange }: PaginationProps) {
  const first = page * size + 1
  const last = page * size + shown

  // Mostra no máximo 5 números ao redor da página atual
  const start = Math.max(0, Math.min(page - 2, totalPages - 5))
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i)

  return (
    <nav className="pg" aria-label="Páginas">
      <span className="pg__info">Mostrando {first}–{last} de {total}{noun ? ` ${noun}` : ''}</span>
      {totalPages > 1 && (
        <span className="pg__buttons">
          <button type="button" className="zv-btn" disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={20} strokeWidth={1.8} aria-hidden="true" />Anterior</button>
          {pages.map((p) => (
            <button key={p} type="button" className="pg-num" aria-current={p === page ? 'page' : undefined} aria-label={`Página ${p + 1}`} onClick={() => onChange(p)}>{p + 1}</button>
          ))}
          <span className="pg__current">Página {page + 1} de {totalPages}</span>
          <button type="button" className="zv-btn" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>Próxima</button>
        </span>
      )}
    </nav>
  )
}
