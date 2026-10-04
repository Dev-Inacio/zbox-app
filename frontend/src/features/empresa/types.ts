// Contrato: docs/contrato-api-empresa.md (HU26). Uma empresa só.

export type CompanyAddress = {
  cep: string | null       // só números, 8 dígitos
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null     // UF, 2 letras
}

export type CompanyRequest = {
  name: string
  tagline: string | null
  whatsapp: string | null  // só números, com DDD
  phone: string | null
  address: CompanyAddress
}

export type Company = CompanyRequest & {
  updatedAt: string | null
  updatedBy: string | null
}
