import logo from '../../assets/logo-zezinho-escuro.png'
import './Logo.css'

type LogoProps = {
  size?: 'md' | 'lg' // md = menu, lg = tela de login
}

// Logo oficial Zezinho Esquadrias (versão para fundo escuro). O nome já está dentro da imagem.
export function Logo({ size = 'md' }: LogoProps) {
  return <img className={`logo-img logo-img--${size}`} src={logo} alt="Zezinho Esquadrias" decoding="async" />
}
