import { useMemo, useState } from 'react'

// Paginação de uma lista que JÁ veio inteira do back (ex.: listas do resumo do mês).
// Quando o back passar a paginar (/month-summary com page/size), troque por page vindo da API.
// Os TOTAIS da tela continuam vindo do resumo — nunca some só a página visível.
export function usePagedList<T>(items: T[], size = 5) {
  const [requested, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(items.length / size))

  // Se a lista encolher (ex.: lançou material e o serviço saiu de "Falta lançar"), não fica numa página vazia
  const page = Math.min(requested, totalPages - 1)

  const content = useMemo(() => items.slice(page * size, page * size + size), [items, page, size])
  return { content, page, size, totalPages, total: items.length, setPage, needsPages: items.length > size }
}
