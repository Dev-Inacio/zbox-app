import { onlyDigits } from './format'

// Validação da TELA (HU09/HU10). Serve para avisar rápido.
// O back valida tudo de novo: ele é a autoridade (nunca confiar no navegador).

export type CustomerFormValues = {
  name: string
  type: '' | 'PERSON' | 'COMPANY'
  phone: string
  whatsapp: string
  zipCode: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
  notes: string
}

export type CustomerFormErrors = Partial<Record<keyof CustomerFormValues, string>>

export const NOTES_MAX = 500

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export function validateField(field: keyof CustomerFormValues, values: CustomerFormValues): string | undefined {
  const value = values[field].trim()

  switch (field) {
    case 'name':
      // RN: único campo obrigatório
      if (!value) return 'Informe o nome do cliente.'
      if (value.length < 3) return 'O nome precisa ter pelo menos 3 letras.'
      if (value.length > 120) return 'O nome pode ter no máximo 120 caracteres.'
      return undefined

    case 'phone': {
      const d = onlyDigits(value)
      if (d && d.length !== 10 && d.length !== 11) return 'Número incompleto. Confira o telefone.'
      return undefined
    }

    case 'whatsapp': {
      const d = onlyDigits(value)
      if (d && d.length !== 11) return 'Número incompleto. Confira o WhatsApp.'
      return undefined
    }

    case 'zipCode': {
      const d = onlyDigits(value)
      if (d && d.length !== 8) return 'O CEP tem 8 números.'
      return undefined
    }

    case 'state':
      if (value && !UFS.includes(value)) return 'Escolha uma UF da lista.'
      return undefined

    case 'notes':
      if (value.length > NOTES_MAX) return `As observações podem ter no máximo ${NOTES_MAX} caracteres.`
      return undefined

    default:
      if (value.length > 120) return 'Máximo de 120 caracteres.'
      return undefined
  }
}

export function validateCustomer(values: CustomerFormValues): CustomerFormErrors {
  const errors: CustomerFormErrors = {}
  for (const field of Object.keys(values) as (keyof CustomerFormValues)[]) {
    const message = validateField(field, values)
    if (message) errors[field] = message
  }
  return errors
}
