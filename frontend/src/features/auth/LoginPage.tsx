import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { Alert } from '../../components/ui/Alert'
import { login } from './authApi'
import { ApiError } from './types'
import type { AuthUser } from './types'
import { validateEmail, validateLogin, validatePassword } from './validation'
import type { LoginFieldErrors } from './validation'
import './LoginPage.css'

// O estado da tela em um lugar só: ou está parada, ou enviando.
type Status = 'idle' | 'submitting'

// A mensagem geral do formulário (acima do botão), quando houver
type FormMessage = { variant: 'error' | 'warning' | 'info'; text: string } | null

type LoginPageProps = {
  onSuccess: (user: AuthUser) => void
}

export function LoginPage({ onSuccess }: LoginPageProps) {
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
      onSuccess(response.user)
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
        <div className="login__frame" aria-hidden="true">
          <span /><span /><span /><span className="is-accent" /><span /><span />
        </div>
        <div className="login__logo">
          <span className="login__logo-mark" aria-hidden="true"><span /></span>
          <span className="login__logo-text">ZBOX</span>
        </div>
        <div className="login__pitch">
          <p className="login__eyebrow">Serralheria e esquadrias</p>
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
