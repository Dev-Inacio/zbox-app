import { useEffect, useRef, useState } from 'react'
import { getCustomer } from '../features/clientes/customersApi'
import { customerMobile, maskPhone } from '../features/clientes/format'

// WhatsApp do cliente para QUALQUER envio (orçamento, cobrança, botão "WhatsApp").
//
// Orçamento e pedido guardam uma CÓPIA do cliente de quando foram criados. Se o WhatsApp
// foi cadastrado ou trocado depois, em Clientes, a cópia fica vazia ou velha.
// Por isso: começa com a cópia (aparece na hora) e logo troca pelo cadastro ATUAL do cliente.
// Se a pessoa já digitou outro número no campo, não sobrescreve.
//
// `customerId` pode vir direto ou de uma busca (ex.: a cobrança só sabe o pedido).
export function useCustomerWhatsapp(customerId: number | null | (() => Promise<number | null>), snapshot: string | null) {
  const [phone, setPhoneState] = useState(maskPhone(snapshot ?? ''))
  const [registered, setRegistered] = useState<string | null>(snapshot) // o que está no cadastro
  const touched = useRef(false)
  const source = useRef(customerId)

  useEffect(() => {
    let active = true
    const id = source.current
    Promise.resolve(typeof id === 'function' ? id() : id)
      .then((resolved) => (resolved == null ? null : getCustomer(resolved)))
      .then((customer) => {
        if (!active || !customer) return
        // O cliente tem um número só ("Celular"). Cadastro antigo com só "Telefone" também vale.
        const mobile = customerMobile(customer)
        setRegistered(mobile)
        if (mobile && !touched.current) setPhoneState(maskPhone(mobile))
      })
      .catch(() => { /* sem conexão: fica com a cópia */ })
    return () => {
      active = false
    }
  }, [])

  function setPhone(value: string) {
    touched.current = true
    setPhoneState(maskPhone(value))
  }

  return { phone, setPhone, registered }
}
