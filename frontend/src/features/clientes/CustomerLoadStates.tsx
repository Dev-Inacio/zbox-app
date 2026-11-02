import { Link } from 'react-router-dom'
import { ApiError } from '../auth/types'
import { Button } from '../../components/ui/Button'
import { AppIcon } from '../../components/ui/AppIcon'

// Estado de erro das páginas de um cliente (detalhe e edição).
// 404 → "não encontrado". Qualquer outro erro → "não foi possível carregar" + tentar de novo.

export function CustomerLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const notFound = error instanceof ApiError && error.status === 404

  return (
    <div className="cl-card">
      <div className="cl-state" role="alert">
        <span className={`cl-state__icon${notFound ? '' : ' cl-state__icon--error'}`} aria-hidden="true">
          <AppIcon name="search" size={26} />
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
