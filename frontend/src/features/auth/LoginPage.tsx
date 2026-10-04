import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { CSSProperties, FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { Alert } from '../../components/ui/Alert'
import { Logo } from '../../components/ui/Logo'
import { login } from './authApi'
import { useAuth } from './useAuth'
import { ApiError } from './types'
import { validateEmail, validateLogin, validatePassword } from './validation'
import type { LoginFieldErrors } from './validation'
import './LoginPage.css'

// O estado da tela em um lugar só: ou está parada, ou enviando.
type Status = 'idle' | 'submitting'

// A mensagem geral do formulário (acima do botão), quando houver
type FormMessage = { variant: 'error' | 'warning' | 'info'; text: string } | null

export function LoginPage() {
  const { signIn, notice } = useAuth()
  const navigate = useNavigate()
  // Se veio de uma tela protegida (ex.: /clientes/12), volta para ela depois de entrar
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/inicio'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [formMessage, setFormMessage] = useState<FormMessage>(null)

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const submitting = status === 'submitting'

  // HU02 RN03: o erro some assim que o usuário corrige (só revalida campos que já mostraram erro)
  function handleEmailChange(value: string) {
    setEmail(value)
    if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: validateEmail(value) }))
  }

  function handlePasswordChange(value: string) {
    setPassword(value)
    if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: validatePassword(value) }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault() // impede o navegador de recarregar a página

    // HU02: valida tudo; se houver erro, foca o primeiro e NÃO chama a API
    const errors = validateLogin(email, password)
    setFieldErrors(errors)
    if (errors.email) return emailRef.current?.focus()
    if (errors.password) return passwordRef.current?.focus()

    setFormMessage(null)
    setStatus('submitting')

    try {
      const response = await login({ email: email.trim(), password })
      signIn(response)
      navigate(from, { replace: true })
    } catch (error) {
      setFormMessage(toFormMessage(error))
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        setPassword('') // HU01: limpa a senha e mantém o e-mail
        passwordRef.current?.focus()
      }
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="login">
      <aside className="login__brand">
        {/* Esquadria animada no fundo (só decoração) */}
        <WindowFrame />
        <div className="login__logo">
          <Logo size="lg" />
        </div>
        <div className="login__pitch login__rise">
          <h2 className="login__headline">Do orçamento à entrega, tudo no mesmo lugar.</h2>
          <p className="login__lead">
            Clientes, orçamentos, pedidos e financeiro da empresa organizados para decidir rápido.
          </p>
        </div>
        <p className="login__copy">© ZBOX · Uso interno</p>
      </aside>

      <main className="login__main">
        {/* noValidate: desliga os balões nativos do navegador; quem valida é a nossa regra (HU02) */}
        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <div className="login__heading">
            <h1 className="login__title">Entrar</h1>
            <p className="login__subtitle">Acesse com seu e-mail e senha.</p>
          </div>

          {notice && !formMessage && <Alert variant="success">{notice}</Alert>}

          <Input
            ref={emailRef}
            label="E-mail"
            type="email"
            name="email"
            autoComplete="username"
            placeholder="seu@email.com.br"
            autoFocus
            value={email}
            error={fieldErrors.email}
            disabled={submitting}
            onChange={(e) => handleEmailChange(e.target.value)}
            onBlur={() => setFieldErrors((e) => ({ ...e, email: validateEmail(email) }))}
          />

          <PasswordInput
            ref={passwordRef}
            label="Senha"
            name="password"
            autoComplete="current-password"
            placeholder="Sua senha"
            value={password}
            error={fieldErrors.password}
            disabled={submitting}
            onChange={(e) => handlePasswordChange(e.target.value)}
            onBlur={() => setFieldErrors((e) => ({ ...e, password: validatePassword(password) }))}
          />

          {formMessage && <Alert variant={formMessage.variant}>{formMessage.text}</Alert>}

          <Button type="submit" fullWidth loading={submitting} loadingText="Entrando…">
            Entrar
          </Button>

          <p className="login__help">Problemas para acessar? Fale com o administrador do sistema.</p>
        </form>
      </main>
    </div>
  )
}

// Traduz o erro em mensagem pelo `code` do contrato, nunca pelo texto, que pode mudar
function toFormMessage(error: unknown): FormMessage {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        return { variant: 'error', text: 'E-mail ou senha inválidos.' }
      case 'ACCOUNT_LOCKED':
        return { variant: 'warning', text: 'Muitas tentativas. Tente novamente em 15 minutos.' }
      case 'TOO_MANY_REQUESTS':
        return { variant: 'warning', text: 'Muitas tentativas. Aguarde alguns minutos.' }
      default:
        return { variant: 'error', text: 'Não foi possível entrar agora. Tente novamente.' }
    }
  }
  // fetch lança TypeError quando não consegue falar com o servidor
  return { variant: 'info', text: 'Não foi possível conectar. Verifique sua internet e tente novamente.' }
}

// ---------- Esquadria animada (decoração do painel escuro) ----------
// 1. o contorno e os vidros são "desenhados" na tela, como se a esquadria fosse montada
// 2. dois pontos de solda soltam faíscas de tempos em tempos
// 3. um reflexo de luz passa pelo vidro
// 4. depois de montada, ela flutua devagar
const PANES = [
  { x: 15, y: 15 },
  { x: 217, y: 15 },
  { x: 15, y: 196.33 },
  { x: 217, y: 196.33, accent: true }, // o vidro com a linha laranja
  { x: 15, y: 377.67 },
  { x: 217, y: 377.67 },
]

const SPARKS_A = [[-18, -14], [16, -20], [22, 6], [-12, 18], [6, 24], [-24, 2], [12, -26]]
const SPARKS_B = [[-16, -12], [14, -18], [18, 8], [-10, 16], [-20, -2]]

function WindowFrame() {
  return (
    <svg className="login__frame" viewBox="0 0 420 560" aria-hidden="true">
      <defs>
        <clipPath id="login-frame-clip">
          <rect x="0" y="0" width="420" height="560" />
        </clipPath>
      </defs>

      <rect className="frame__outline" x="1" y="1" width="418" height="558" pathLength={1} />

      {PANES.map((pane, i) => (
        <rect
          key={i}
          className={`frame__pane${pane.accent ? ' frame__pane--accent' : ''}`}
          x={pane.x}
          y={pane.y}
          width="188"
          height="167.33"
          pathLength={1}
          style={{ animationDelay: `${0.5 + i * 0.12}s` }}
        />
      ))}

      <g clipPath="url(#login-frame-clip)">
        <rect className="frame__glass" x="-200" y="-100" width="120" height="760" />
      </g>

      <circle className="frame__weld" cx="217" cy="196.33" r="3" />
      {SPARKS_A.map(([dx, dy], i) => (
        <circle
          key={`a${i}`}
          className="frame__spark"
          cx="217"
          cy="196.33"
          r="1.6"
          style={{ '--dx': `${dx}px`, '--dy': `${dy}px` } as CSSProperties}
        />
      ))}

      <circle className="frame__weld frame__weld--b" cx="203" cy="377.67" r="2.6" />
      {SPARKS_B.map(([dx, dy], i) => (
        <circle
          key={`b${i}`}
          className="frame__spark frame__spark--b"
          cx="203"
          cy="377.67"
          r="1.4"
          style={{ '--dx': `${dx}px`, '--dy': `${dy}px` } as CSSProperties}
        />
      ))}
    </svg>
  )
}
