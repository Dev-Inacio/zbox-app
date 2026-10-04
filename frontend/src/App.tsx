import { Button } from './components/ui/Button'

export default function App() {
  return (
    <div style={{ padding: 32, display: 'flex', gap: 16 }}>
      <Button>Entrar</Button>
      <Button loading loadingText="Entrando…">Entrar</Button>
      <Button disabled>Desabilitado</Button>
    </div>
  )
}
