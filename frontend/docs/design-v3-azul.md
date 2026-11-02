# ZBOX v3 · Azul — como aplicar no código

**Nada do back muda.** Mesmas rotas, serviços, campos e cálculos. Só a parte visual.
Testei numa cópia do front: `tsc` sem erros, `vite build` ok, telas abrindo em azul com o menu lateral.

## Passo a passo
1. **Faça um commit antes** (para poder voltar e comparar com `git diff`).
2. **Copie a pasta `src/` do pacote por cima da sua.**
   - `styles/tokens.css`: as cores azuis. *Isso sozinho recolore quase tudo.* (As variáveis `--wine*` mantiveram o nome para nada quebrar, mas agora são azul.)
   - `components/layout/Sidebar.*` + `AppLayout.*`: menu lateral com degradê azul; no celular/tablet vira barra no topo com botão **Menu**.
   - `components/layout/PageHero.css`: topo das páginas claro (mesmas classes).
   - `components/ui/Logo.*` e `assets/`:
     - `zbox-logo-escuro.png`: para fundo **escuro/azul** (menu, login, celular).
     - `zbox-logo-claro.png`: para fundo **branco** (PDF e impressão).
   - `components/zbox/`: componentes do padrão + `StatusTag` e `PageHeader`.
3. **Apague** `src/assets/zbox-logo-vinho.png` se existir (não é mais usado).
4. **Rode o script de cores** na raiz do front:
   ```bash
   node aplicar-azul.mjs
   ```
   Troca o laranja antigo **e** o vinho fixo (se você já tinha colado) pelas variáveis, em todos os `.css`.
5. **Login com efeito** (fundo animado, logo centralizada, frase em texto): cole o bloco do final de
   `referencia/features/auth/LoginPage.css` no seu `LoginPage.css` e siga o comentário dele
   (são 2 trechos de JSX no painel da marca). O formulário não muda.
6. **PDF/impressão**: no componente do documento do orçamento, use `zbox-logo-claro.png`.
7. **Ícones do app (PWA)**: copie `public/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `favicon-32.png`
   e no `vite-plugin-pwa` use `theme_color: '#0F2A4A'`.
8. `npm run build` e `npm run dev`. Confira as telas.

## Cores
| Uso | Cor |
|---|---|
| Azul principal (botão, item ativo, links) | `#1F4E8C` |
| Azul-marinho (menu, topo) | `#0F2A4A` |
| Azul claro (destaques) | `#2B6CB0` |
| Fundo suave | `#E8F0FA` |
| Pago / Atrasado / Atenção | verde `#247A50` · vermelho `#B83240` · amarelo `#B7791F` (sempre com texto) |

## Checklist de QA
- [ ] Todas as rotas abrem; o menu marca a página certa.
- [ ] "Recolher menu" funciona e é lembrado.
- [ ] Tablet (820px) e celular (390px): botão **Menu** abre a gaveta; Esc fecha.
- [ ] Login: animação roda; com "reduzir movimento" ligado, fica parado.
- [ ] PDF sai com a logo de fundo branco, nítida.
- [ ] DevTools → Network: nenhuma requisição mudou.
- [ ] Playwright: seletores por `data-testid` continuam; se algum usava o texto "Perfil" no menu, troque para "Dados da empresa".
