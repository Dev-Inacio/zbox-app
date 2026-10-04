import mascote from '../../assets/zbox-mascote.webp'
import './Logo.css'

type LogoProps = {
  size?: 'md' | 'lg' // md = header, lg = tela de login
}

// Logo oficial do ZBOX: boneco da empresa (fundo transparente) + "ZBOX" metálico
// com profundidade em cobre + slogan embaixo.
// Um componente só, para o logo ser IGUAL em todas as telas.
export function Logo({ size = 'md' }: LogoProps) {
  return (
    <span className={`logo logo--${size}`}>
      {/* alt="" porque é decorativa: o nome "ZBOX" já está escrito ao lado */}
      <img className="logo__mark" src={mascote} alt="" width={225} height={240} decoding="async" />
      <span className="logo__text">
        <span className="logo__name">ZBOX</span>
        <span className="logo__tagline">Serralheria e esquadrias</span>
      </span>
    </span>
  )
}
