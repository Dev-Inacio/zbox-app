// Regras da HU02. O front valida para ajudar o usuário; o back valida de novo e decide.

export type LoginFieldErrors = {
  email?: string
  password?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(value: string): string | undefined {
  const email = value.trim()
  if (email === '') return 'Informe seu e-mail.'
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return 'Digite um e-mail válido. Ex.: nome@empresa.com'
  }
  return undefined
}

export function validatePassword(value: string): string | undefined {
  if (value === '') return 'Informe sua senha.'
  if (value.length > 128) return 'A senha pode ter no máximo 128 caracteres.'
  return undefined
}

export function validateLogin(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {}
  const emailError = validateEmail(email)
  const passwordError = validatePassword(password)
  if (emailError) errors.email = emailError
  if (passwordError) errors.password = passwordError
  return errors
}
