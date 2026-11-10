import logo from '../../assets/logo-zezinho.png'
import './Logo.css'

type LogoProps = {
  size?: 'md' | 'lg' // md = menu, lg = tela de login
}

// Logo oficial do ZBOX v3 (azul). O nome já está dentro da imagem.
export function Logo({ size = 'md' }: LogoProps) {
  return <img className={`logo-img logo-img--${size}`} src={logo} alt="Zezinho Esquadrinhas" decoding="async" />
}
