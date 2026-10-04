import { useEffect, useState } from 'react'

// Busca dados e controla carregando / sucesso / erro.
// `key` identifica o pedido: quando muda (outro filtro, outra página, "tentar de novo"),
// busca de novo. Enquanto a resposta da key atual não chega, `loading` é true.
// O `fetcher` precisa ser estável (useCallback) para não buscar em toda renderização.

type Result<T> = { key: string; data?: T; error?: unknown }

export function useRequest<T>(key: string, fetcher: () => Promise<T>) {
  const [result, setResult] = useState<Result<T> | null>(null)

  useEffect(() => {
    // `active` evita mostrar uma resposta velha (ex.: a pessoa trocou o filtro antes de chegar)
    let active = true
    fetcher()
      .then((data) => {
        if (active) setResult({ key, data })
      })
      .catch((error: unknown) => {
        if (active) setResult({ key, error })
      })
    return () => {
      active = false
    }
  }, [key, fetcher])

  const current = result?.key === key ? result : null

  return {
    loading: current === null,
    data: current?.data,
    error: current?.error,
    // Atualiza o dado na tela sem buscar de novo (ex.: depois de desativar)
    setData: (data: T) => setResult({ key, data }),
  }
}
