import { Link } from 'react-router-dom'
import { ApiError } from '../auth/types'
import { Button } from '../../components/ui/Button'

// Estado de erro das páginas de um cliente (detalhe e edição).
// 404 → "não encontrado". Qualquer outro erro → "não foi possível carregar" + tentar de novo.

export function CustomerLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const notFound = error instanceof ApiError && error.status === 404

  return (
    <div className="cl-card">
      <div className="cl-state" role="alert">
        <span className={`cl-state__icon${notFound ? '' : ' cl-state__icon--error'}`} aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {notFound ? (
              <>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6" />
                <path d="M12 16.5v.5" />
              </>
            )}
          </svg>
        </span>
        <p className="cl-state__title">{notFound ? 'Cliente não encontrado.' : 'Não foi possível carregar o cliente.'}</p>
        <p className="cl-state__text">
          {notFound ? 'Ele pode ter sido removido ou o endereço está errado.' : 'Verifique sua conexão e tente de novo.'}
        </p>
        {notFound ? (
          <Link to="/clientes" className="cl-cta">Voltar para clientes</Link>
        ) : (
          <Button className="btn--secondary" onClick={onRetry}>Tentar novamente</Button>
        )}
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="cl-card cl-card--elevated">
      <div className="cl-skeleton" role="status" aria-label="Carregando">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="cl-skeleton__row">
            <span style={{ width: `${45 + ((i * 17) % 40)}%` }} />
            <span style={{ width: `${25 + ((i * 11) % 25)}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}
