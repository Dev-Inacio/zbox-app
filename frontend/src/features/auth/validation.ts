// Regras da HU02. O front valida para ajudar o usuário; o back valida de novo e decide.

export type LoginFieldErrors = {
  username?: string
  password?: string
}

// O login é por usuário (texto livre, como está no cadastro do back), não precisa ter formato de e-mail
export function validateUsername(value: string): string | undefined {
  const username = value.trim()
  if (username === '') return 'Informe seu usuário.'
  if (username.length > 254) return 'O usuário pode ter no máximo 254 caracteres.'
  return undefined
}

export function validatePassword(value: string): string | undefined {
  if (value === '') return 'Informe sua senha.'
  if (value.length > 128) return 'A senha pode ter no máximo 128 caracteres.'
  return undefined
}

export function validateLogin(username: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {}
  const usernameError = validateUsername(username)
  const passwordError = validatePassword(password)
  if (usernameError) errors.username = usernameError
  if (passwordError) errors.password = passwordError
  return errors
}
