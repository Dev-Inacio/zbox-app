import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// "Mensagem de passagem": uma tela manda um recado para a próxima ao navegar.
//   navigate('/clientes/12', { state: { flash: 'Cliente cadastrado com sucesso.' } })
// A tela de destino mostra o recado UMA vez. Depois limpamos o state do histórico,
// senão a mensagem voltaria ao apertar F5 ou "voltar".

type FlashState = { flash?: string } | null

export function useFlashMessage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [message, setMessage] = useState<string | null>(() => (location.state as FlashState)?.flash ?? null)

  useEffect(() => {
    if ((location.state as FlashState)?.flash) {
      navigate(location.pathname + location.search, { replace: true, state: null })
    }
  }, [location.state, location.pathname, location.search, navigate])

  const clear = useCallback(() => setMessage(null), [])

  return [message, setMessage, clear] as const
}
