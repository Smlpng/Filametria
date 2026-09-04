<p align="center">
  <img src="Filametria Logo.svg" width="110" alt="Fatia">
</p>

<h1 align="center">Filametria</h1>

<p align="center">
  Calculadora de preços para impressão 3D — a partir da estimativa do teu slicer.<br>
  <a href="README.md">English</a> · <b>Português</b>
</p>

---

Metes o que o slicer te dá — gramas, tempo, custo — e o Fatia devolve o preço, o lucro real e um orçamento pronto a enviar ao cliente. Como app local é um único ficheiro HTML, sem servidor e sem conta — e instalável como aplicação com um clique. Para uso permanente, o servidor Python incluído acrescenta login e memória partilhada por utilizador.

**[▶ Abrir o Filametria](https://filametria.github.io/fatia/)**

## Porquê

A maior parte das calculadoras de impressão 3D só soma filamento e eletricidade. Isso não é o teu custo — é uma fração dele. Fica de fora a amortização da máquina, o tempo de preparação de cada mesa, o desperdício, a embalagem, e sobretudo o tempo de impressora, que é onde os trabalhos longos silenciosamente deixam de dar lucro.

O Fatia calcula as duas coisas em paralelo: **o que te custa** e **o que cobras**. A diferença entre elas é o teu lucro, e está sempre visível.

## O que faz

**Base pelo slicer.** Cada mesa tem peso, tempo e custo em reais (R$). Se preencheres o custo, ele manda e o cálculo por peso é ignorado. Um fator corrige a estimativa, porque o slicer só conta o preço da bobine — não os portes do fornecedor nem o desperdício.

**Retificação pós-impressão.** Depois de imprimires, metes os valores reais. Ele mostra o desvio e, se for grande, oferece guardá-lo como desvio típico das próximas estimativas. É isto que impede a calculadora de envelhecer.

**A mesa como unidade de trabalho.** Base fixa e minutos de preparação por mesa — fatiar, preparar a base, arrancar peças. Não dependem de quantas peças lá cabem, e é por isso que encher a mesa compensa. O indicador de densidade quantifica exatamente quanto.

**Posicionamento de mercado.** Três réguas: taxa horária de máquina, preço por peça e preço por mesa. Os valores de referência foram recolhidos em agosto de 2026 e envelhecem sozinhos aplicando a inflação prevista pelo Banco de Portugal. Podes ainda colar orçamentos de concorrentes para o mesmo trabalho, e registar o histórico do que os teus clientes aceitaram ou recusaram.

**Portes reais.** 16 serviços com preços atuais: CTT Correio Registado, Encomenda Postal T1/T2 com e sem entrega ao domicílio, aéreo para Madeira e Açores, InPost Locker nacional e InPost para oito países europeus. O peso da embalagem entra no escalão, que é o que a transportadora pesa.

**Base de impressoras.** 17 modelos com preço, consumo médio e vida útil. Podes marcar favoritas, adicionar as tuas e editar tudo.

**Várias impressoras no mesmo trabalho.** Cada mesa escolhe a sua máquina. O custo horário é o dessa máquina e o total sai da média ponderada pelo tempo de cada mesa. Se retificares o tempo real, todas as mesas escalam na mesma proporção — regra de três simples. O painel mostra o R$/h de cada máquina e a média resultante.

**Modelação 3D, antes de imprimir.** O desenho é trabalho e paga-se. Acrescentas os modelos que fizeste — nome e tempo cada um, com **+** e **−** — e o Fatia cobra-os à tarifa horária de modelação, à parte da impressão e com a margem de mão de obra. Fica de fora do desconto por quantidade de propósito: desenha-se uma vez, imprimam-se 1 ou 100. Sem modelos, nada disto aparece no orçamento; com modelos, o cliente vê a linha e, se quiseres, os nomes e as horas de cada um.

**Imposto: incluído ou acrescentado.** Duas maneiras de o imposto entrar no preço. **Incluído** — o total é o que o cliente paga e o imposto sai de lá de dentro, ou seja vem antes do teu lucro. **Acrescentado** — o total é o teu preço limpo, o imposto vai por cima e quem o paga é o cliente, sem te tocar na margem. O orçamento mostra sempre o subtotal e o imposto em separado.

**As peças contam-se por mesa.** Cada mesa diz quantas peças saem dela e o campo lá em cima mostra o total somado — 2 peças em 2 mesas são 2 peças, não 4. O escalão de desconto por quantidade segue esse total.

**Gestor de filamentos.** Cada filamento é um nome e os seus preços — preço/kg e portes do fornecedor. Acrescentas e removes os teus, e ficam guardados nos presets e dentro do ficheiro do Exportar. Cada mesa escolhe que filamentos usou, e pode levar mais do que um.

**Ligado ao [Bobina](https://github.com/filametria/bobina), em direto.** Se tiveres o Bobina a correr nesta máquina, o seletor de filamentos mostra o teu inventário verdadeiro: a bobine desenhada na cor certa, o **custo real por quilo** (o que foi mesmo pago pelas bobines que ainda tens), quantos gramas te restam, quantas bobines e onde estão. **Não há nada para importar nem para atualizar** — os números são os de agora e mudam sozinhos quando mexes no Bobina. E como o Fatia passa a saber o que tens em casa, avisa-te quando o trabalho que estás a orçamentar **não cabe no stock**. Um filamento do Bobina não se edita aqui (o sítio de o mudar é lá); o ⧉ faz uma cópia tua, editável, com o preço de agora. Os teus filamentos escritos à mão continuam a existir ao lado dos dele.

**Vários filamentos na mesma mesa.** Quando uma mesa leva mais do que um filamento e não tem o custo do slicer, não há como saber quantos gramas são de cada: o Fatia estima pela média dos preços dessa mesa — e avisa-te, porque basta meteres o custo do slicer nessa mesa para o valor ficar exato. O orçamento do cliente mostra os filamentos usados, e discrimina-os por mesa quando há mais do que um.

**Orçamento do cliente.** Vista limpa e imprimível, com logo mini do Fatia, ficha técnica e sem uma única margem à vista. Opcionalmente:

- **as impressoras usadas** — interruptor geral, e um visto por mesa para escolher quais aparecem;
- **a nota de rodapé** — "Valores em reais. Orçamento válido por 30 dias." é texto teu, editável e desligável;
- **a tua marca** — logótipo, nome de quem fatura, NIF, contactos, morada, slogan em itálico e uma mensagem destacada ao cliente;
- **imposto de faturação** — presets para Portugal IVA 23%, 13% e 6%, Espanha IVA 21%, França TVA 20%, Alemanha MwSt. 19%, Itália IVA 22%, Países Baixos btw 21%, Reino Unido VAT 20%, ou uma taxa personalizada/geral, incluído no total ou acrescentado por cima. O orçamento separa sempre subtotal e imposto;
- **QR codes** — desligados por omissão. O QR é gerado do endereço que escreveres, sem rede nem serviços externos, e qualquer um pode ser substituído por uma imagem tua (PNG/JPEG).

**Presets e memória.** Guarda configurações com nome, exporta e importa em JSON. Tudo entra no template: impressoras por mesa, logótipo, textos e QR codes. Ele lembra-se de onde ficaste.

**Modo simples.** Esconde tudo o que não estás a usar. Clica nos títulos dos painéis para os dobrar — e nos subtítulos, para dobrar só aquela secção; o botão **⌃ Fechar secções** faz as todas de uma vez. As definições de custo nascem dobradas, porque afinam-se uma vez e depois esquecem-se; o painel do trabalho nasce aberto. O que deixares fechado fica fechado da próxima vez.

## Como usar

Abre o `index.html` no browser. É tudo.

**Instalar como aplicação.** Servido por `http(s)` — no GitHub Pages ou num servidor local — o Fatia é uma PWA: aparece um botão **⤓ Instalar app**, ou usas o menu do browser (Chrome/Edge: ⋮ → *Instalar Fatia*; telemóvel: partilhar → *Adicionar ao ecrã principal*). Passa a abrir em janela própria, com ícone, e funciona sem rede.

Duas coisas só funcionam quando a página é servida por `http(s)` — a atualização automática do preço de mercado da eletricidade e a verificação de atualizações dos dados. Aberto do disco com `file://`, o browser bloqueia qualquer pedido para fora, e não há volta a dar. Usa o GitHub Pages, ou um servidor local:

O **preço de mercado da eletricidade** precisa mesmo do servidor incluído (`server.py`): a API do mercado só autoriza pedidos vindos do domínio dela, por isso um pedido feito pelo browser é sempre bloqueado por CORS. O servidor pede por ti em `/api/spot`, com uns minutos de cache. Sem ele, a app fica em modo manual de eletricidade — tudo o resto funciona na mesma.

```bash
python3 -m http.server 8000     # depois abre http://localhost:8000
```

Para uso permanente com memória partilhada, corre antes o servidor incluído:

```bash
python3 server.py --host 0.0.0.0 --port 8098
```

Continua a servir a mesma PWA, mas acrescenta `/api/*` para login e memória por utilizador em SQLite. Por defeito, o primeiro utilizador só pode ser criado pela LAN/Meshnet; usa `FATIA_ALLOW_SIGNUP=1` apenas se quiseres permitir auto-registo.

## Fontes dos dados de referência

| O quê | Fonte | Data |
| --- | --- | --- |
| Taxas horárias de máquina e mão de obra | [LayerMath](https://layermath.com/blog/3d-printing-hourly-rate) | jun 2026 |
| Preço por peça em Portugal | [Zaask](https://www.zaask.pt/quanto-custa/impressao-3d) | 2026 |
| Previsão de inflação | [Banco de Portugal](https://www.bportugal.pt/comunicado/comunicado-do-banco-de-portugal-sobre-o-boletim-economico-de-junho-de-2026) | jun 2026 |
| Portes CTT | [CTT](https://www.ctt.pt/particulares/enviar/para-portugal/encomenda-postal) | ago 2026 |
| Portes InPost | [InPost](https://www.inpost.pt/faz-um-envio/nossas-tarifas-de-envio) | ago 2026 |
| Preço de mercado da eletricidade | [energy-charts.info](https://api.energy-charts.info/) (OMIE / zona PT) | ao vivo |
| Presets de IVA / imposto | [Your Europe](https://europa.eu/youreurope/business/finance-and-tax/vat/vat-rules-rates/index_en.htm) e [GOV.UK](https://www.gov.uk/vat-rates) | jul 2026 |

Estes valores são **estimativas informativas**, não cotações. Confirma-os antes de os usares num orçamento real.

## Licença

**Uso pessoal — livre e gratuito.** Usa, copia e modifica à vontade para projetos pessoais, aprendizagem e trabalhos sem fins comerciais.

**Uso comercial — sob consulta prévia.** Se usares o Fatia para orçamentar trabalho que vendes:

| Faturação mensal | Mensalidade |
| --- | --- |
| Até 10 000 € | 10 €/mês |
| Acima de 10 000 € | 100 €/mês |

Contacta **contato@filametria.com.br** antes de começares. Termos completos em [`LICENCA.md`](LICENCA.md) (PT) e [`LICENSE`](LICENSE) (EN, versão que prevalece).

---

<p align="center">
  <i>Calculadora 3D — powered by <b>Filametria</b></i><br>
  <sub><i>Filametria — Soluções em impressão 3D, protótipos experimentais, produtos próprios fabricados em casa (extrusão FDM, filamento e manufatura aditiva) e serviços por encomenda.</i></sub>
</p>

