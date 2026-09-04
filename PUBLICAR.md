# Publicar e instalar

## Abrir sem instalar nada

Duplo clique no `index.html`. Funciona tudo menos duas coisas: a atualização automática do preço
da eletricidade e a verificação de atualizações dos dados. Aberto do disco (`file://`) o browser
bloqueia qualquer pedido para fora e não há volta a dar.

Para as ter, serve a pasta por `http(s)`:

```bash
python -m http.server 8000
```

E abre <http://localhost:8000>.

## Publicar no GitHub Pages

Com o [`gh`](https://cli.github.com/) autenticado, a partir desta pasta:

```bash
gh repo create fatia --public --source=. --remote=origin --push
```

Depois liga o Pages:

```bash
gh api -X POST repos/filametria/fatia/pages -f "source[branch]=main" -f "source[path]=/"
```

Ou pela interface: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**.

Um ou dois minutos depois fica em **<https://filametria.github.io/fatia/>**.

## Instalar como aplicação

Nesse endereço (ou em qualquer servidor `https`) o Fatia é uma PWA e pode ser instalado:

- **Chrome / Edge (computador)** — botão **⤓ Instalar app** no cabeçalho, ou menu ⋮ → *Instalar Fatia*
- **Android** — menu do browser → *Adicionar ao ecrã principal*
- **iPhone / iPad** — botão de partilha → *Adicionar ao ecrã principal*

Passa a abrir em janela própria, com ícone, e o `sw.js` mantém-no a funcionar sem rede. A página em
si vai sempre primeiro à rede, por isso uma versão nova aparece sozinha na abertura seguinte.

Ficheiros envolvidos: `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `icon-180.png`.

## Confirmar depois de publicar

- [ ] A página abre e o popup da licença aparece
- [ ] Escolher uma impressora preenche preço, vida útil e consumo
- [ ] Cada mesa deixa escolher a sua impressora, e o painel de custos mostra a média ponderada
- [ ] O painel de eletricidade puxa o preço de mercado sozinho
- [ ] O seletor de imposto tem Portugal IVA 23% por omissão e permite uma taxa personalizada
- [ ] "Procurar atualizações" diz *Dados atualizados para a versão de 2026-08-11*
- [ ] O botão do orçamento do cliente abre a vista limpa e imprime bem
- [ ] O orçamento mostra o logo mini do Fatia, subtotal antes de IVA/imposto, imposto incluído e total
- [ ] Com a marca ligada, o logótipo e os contactos saem no topo do orçamento
- [ ] Com os QR ligados, os códigos aparecem no rodapé e leem-se com o telemóvel
- [ ] Aparece o botão **Instalar app** (ou a opção de instalar no menu do browser)

## Atualizar os dados mais tarde

Editas o `dados.json`, mudas o campo `data`, e fazes push. Todas as cópias servidas por
http(s) passam a usar os valores novos sem tocar no `index.html`.

Se mudares o nome do repositório ou do utilizador, muda também a constante `DADOS_URL`
dentro do `index.html` e o campo `id` do `manifest.webmanifest`.
