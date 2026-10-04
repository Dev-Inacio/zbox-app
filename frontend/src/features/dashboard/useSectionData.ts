import { useEffect, useState } from 'react'
import type { LoadState } from '../../components/ui/SectionCard'

// Hook que busca os dados de UMA seção e controla os 4 estados.
// Cada seção usa o seu próprio hook → carregamento independente (HU05 RN03).
export function useSectionData<T>(fetcher: () => Promise<T[]>) {
  const [state, setState] = useState<LoadState>('loading')
  const [items, setItems] = useState<T[]>([])
  const [attempt, setAttempt] = useState(0) // muda a cada "Tentar novamente"

  useEffect(() => {
    // `active` evita atualizar a tela com uma resposta antiga
    // (ex.: o usuário saiu da página antes de a API responder)
    let active = true

    fetcher()
      .then((data) => {
        if (!active) return
        setItems(data)
        setState(data.length === 0 ? 'empty' : 'success')
      })
      .catch(() => {
        if (active) setState('error')
      })

    return () => {
      active = false
    }
  }, [fetcher, attempt])

  function retry() {
    setState('loading')
    setAttempt((n) => n + 1) // muda a dependência → o efeito busca de novo
  }

  return { state, items, retry }
}
