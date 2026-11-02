import type { ReactNode } from 'react'
import './NoAutofill.css'

// Impede o "Salvar endereço?" / "Atualizar endereço?" do Chrome (e a sugestão de salvar na conta Google).
//
// O Chrome IGNORA autocomplete="off" em endereço e telefone, e guarda o que foi digitado mesmo se a tela
// limpar os campos depois. O que ele respeita: só reconhece um formulário de endereço quando o MESMO
// <form> tem 3 ou mais campos. Então cada campo fica no seu próprio <form> invisível (display: contents),
// e o Chrome nunca vê um formulário de endereço inteiro.
//
// Regras para usar:
//   - Um campo por <NoAutofill>.
//   - Não pode ficar dentro de outro <form> (form dentro de form não vale no HTML).
//   - Enter dentro do campo não envia nada: quem salva é o botão da tela.
export function NoAutofill({ children }: { children: ReactNode }) {
  return (
    <form className="no-autofill" autoComplete="off" noValidate onSubmit={(e) => e.preventDefault()}>
      {children}
    </form>
  )
}
