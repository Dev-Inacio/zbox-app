# ZBOX v3 Azul · fonte do design (HTML de cada tela)

Estes são os **arquivos-fonte** do design — o mesmo HTML que está no canvas, não imagens.
Cada medida, cor, fonte, espaçamento e texto está no código de cada tela.

## Como usar
1. Abra `index.html` no navegador (duplo clique). Ele lista todas as telas.
2. Abra a tela que vai implementar e o seu app lado a lado.
3. Botão direito → **Inspecionar** em qualquer elemento: aparecem o tamanho, a cor, a fonte e o espaçamento exatos.
4. Para comparar pixel a pixel: no DevTools, ponha a largura em **1440px** (computador) ou **390px** (celular).

## Pastas
- `telas/computador/`: 16 telas (1440px), na ordem do fluxo — o Financeiro é uma página só (13) — + `00-design-system` e `15-orcamento-pdf`.
- `telas/celular/`: 7 telas (390px).
- `assets/`: `zbox-logo-escuro.png` (menu, login, celular) e `zbox-logo-claro.png` (PDF e impressão).
- `tokens.css`: as mesmas cores e medidas em variáveis CSS (é o do pacote de código).

## Regras que valem em todas as telas
| Item | Valor |
|---|---|
| Fonte de títulos | Archivo 700 · título da página 32px · título de card 22px |
| Fonte de texto | IBM Plex Sans · 17px padrão · 15px mínimo |
| Azul principal | `#1F4E8C` (botão principal, item ativo, links) |
| Azul-marinho | `#0F2A4A` (menu, degradê até `#1F4E8C`) |
| Fundo da página / card | `#F6F5F3` / `#FFFFFF` com borda `#E5E0E2`, raio 16px |
| Campos | altura 52px, borda 1.5px `#CFC8CB`, raio 10px |
| Botões | 48px (normal) · 56px (principal da tela) · raio 10px · só 1 botão azul por tela |
| Situações | ponto + palavra, nunca só cor: verde `#247A50`, vermelho `#B83240`, amarelo `#B7791F`, azul `#2F5D8A` |
| Menu lateral | 264px, grupos Principal/Vendas/Operação/Gestão, ícone sempre com texto |
| Espaçamento | múltiplos de 4/8: 8, 12, 16, 20, 24, 28, 32, 40 |
| Ícones | Lucide (já no projeto: `lucide-react`), traço 1.8 |

## Importante
- Os dados nas telas (nomes, valores) são **exemplo**. No código, venha do back como já vem hoje — **nada de API muda**.
- O que o design não mostra (carregando, vazio, erro) segue o `00-design-system`.
