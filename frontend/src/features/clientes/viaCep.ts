// Busca de endereço pelo CEP (HU09 — aprovado pela PO: ViaCEP).
// Chamada direta do navegador para https://viacep.com.br (serviço público e gratuito).
// Se o ViaCEP falhar, a pessoa preenche o endereço à mão: o cadastro nunca trava por causa dele.

export type CepAddress = {
  street: string
  district: string
  city: string
  state: string
}

export type CepResult =
  | { status: 'found'; address: CepAddress }
  | { status: 'not-found' }
  | { status: 'unavailable' } // sem internet, ViaCEP fora do ar ou demorou demais

type ViaCepResponse = {
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean | string
}

export async function lookupCep(cepDigits: string, signal: AbortSignal): Promise<CepResult> {
  // desiste depois de 5 segundos
  const timeout = AbortSignal.timeout(5000)
  const combined = AbortSignal.any([signal, timeout])

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, { signal: combined })
    if (!response.ok) return { status: response.status === 400 ? 'not-found' : 'unavailable' }

    const data = (await response.json()) as ViaCepResponse
    if (data.erro) return { status: 'not-found' }

    return {
      status: 'found',
      address: {
        street: data.logradouro ?? '',
        district: data.bairro ?? '',
        city: data.localidade ?? '',
        state: data.uf ?? '',
      },
    }
  } catch (error) {
    // Cancelado porque a pessoa digitou outro CEP: quem chamou ignora
    if (signal.aborted) throw error
    return { status: 'unavailable' }
  }
}
