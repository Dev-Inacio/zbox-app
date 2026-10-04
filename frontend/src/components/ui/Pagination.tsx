import './Pagination.css'

// Paginação das listas (Clientes, Orçamentos…). "page" começa em 0, como no Spring.
type PaginationProps = { page: number; totalPages: number; size: number; total: number; shown: number; onChange: (page: number) => void }

export function Pagination({ page, totalPages, size, total, shown, onChange }: PaginationProps) {
  const first = page * size + 1
  const last = page * size + shown

  // Mostra no máximo 5 números ao redor da página atual
  const start = Math.max(0, Math.min(page - 2, totalPages - 5))
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i)

  return (
    <nav className="pg" aria-label="Paginação">
      <span className="pg__info">Mostrando {first}–{last} de {total}</span>
      {totalPages > 1 && (
        <div className="pg__buttons">
          <button type="button" className="pg-btn" aria-label="Página anterior" disabled={page === 0} onClick={() => onChange(page - 1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              className="pg-btn pg-btn--number"
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Página ${p + 1}`}
              onClick={() => onChange(p)}
            >
              {p + 1}
            </button>
          ))}
          <button type="button" className="pg-btn" aria-label="Próxima página" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      )}
    </nav>
  )
}

