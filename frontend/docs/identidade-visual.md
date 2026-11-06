# Identidade visual

Logo, cores, tipografia, componentes e fotos usados nas telas do Solar Gestão. Tudo veio do site institucional anterior da Don Energy, guardado na branch `legado/site-don-energy`.

## Onde cada coisa está

```
frontend/
├─ index.html              # fontes (Sora e Inter) e ícones
├─ src/tokens.css          # cores, fontes, raios e classes site-*
├─ src/dados/empresa.ts    # nome, telefone, WhatsApp, endereço, horários e logo
├─ src/dados/fotos.ts      # as 11 fotos, com texto alternativo e legenda
└─ public/
   ├─ logo/                # assinaturas da marca e imagem de compartilhamento
   ├─ icones/              # favicon e ícones de aplicativo
   └─ fotos/
      ├─ portfolio/        # variantes de cada foto em 480, 960 e 1440 px
      └─ otimizadas/       # imagem do topo em AVIF e WebP e recortes menores
```

## Logo

| Arquivo em `public/logo/` | Tamanho | Fundo | Uso |
| --- | --- | --- | --- |
| `don-energy-marca-sem-microtexto-834x558.webp` (e `.png`) | 834 × 558 | Transparente, letras brancas | **Assinatura principal:** cabeçalho e rodapé, sempre sobre fundo escuro |
| `don-energy-logo.png` | 1200 × 1200 | Azul `#1E55A6` | Arte original com “ENERGIA SOLAR”; redes sociais e referência |
| `don-energy-logo-compacta.png` | 167 × 112 | Transparente | Só em tamanho pequeno. Não ampliar |
| `og-image.png` | 1200 × 630 | Azul `#384C96` | Imagem de compartilhamento |

Regras:

- Manter a proporção e a transparência, sem esticar, recortar, recolorir ou redesenhar. Se faltar uma versão, peça o arquivo ao dono da marca.
- As letras da assinatura são brancas: ela só funciona sobre o azul profundo, o azul da marca ou uma foto escurecida.
- Altura no cabeçalho: 48 px no celular e 56 px a partir de 768 px. No rodapé: 64 px.

## Cores

Os tokens geram as classes do Tailwind (`bg-brand-deep`, `text-brand-blue` e assim por diante).

| Token | Hex | Papel |
| --- | --- | --- |
| `brand-blue` | `#384C96` | Cor principal: títulos, links e rótulos |
| `brand-orange` | `#D88739` | Ação: botão principal e destaque da economia |
| `brand-ink` | `#171F32` | Texto escuro e texto sobre o laranja |
| `brand-deep` e `brand-blue-header` | `#182447` | Cabeçalho sólido, rodapé, faixas de destaque e fundo da página de login |
| `brand-soft` | `#F5F6FA` | Fundo de seção alternada e da área restrita |
| `brand-green` | `#94B94A` | Cor de marca reservada, sem uso nas telas |
| `muted-foreground` | `#535C6D` | Texto secundário |
| `border` | `#D9DDE6` | Bordas e divisórias |

`logo-orange` (`#F68B39`) e `logo-blue` (`#1E55A6`) são as cores da arte da logo: use só em peças que reproduzem a própria logo.

O botão flutuante do WhatsApp usa o verde oficial `#25D366` de propósito.

### Contraste

O mínimo para texto normal é 4,5:1 (WCAG AA).

| Combinação | Contraste | Situação |
| --- | --- | --- |
| Branco sobre `#182447` | 15,2:1 | Adequado |
| `#171F32` sobre branco | 16,4:1 | Adequado |
| `#384C96` sobre branco | 8,0:1 | Adequado |
| `#384C96` sobre `#F5F6FA` | 7,4:1 | Adequado |
| `#535C6D` sobre branco | 6,7:1 | Adequado |
| `#171F32` sobre `#D88739` | 5,8:1 | Adequado: é o texto do botão laranja |
| `#D88739` sobre `#182447` | 5,4:1 | Adequado: é o destaque da economia |
| Branco sobre `#D88739` | 2,8:1 | **Não usar:** botão laranja leva texto escuro |
| `#94B94A` sobre branco | 2,3:1 | **Não usar** como cor de texto |

## Tipografia

**Sora** nos títulos (`font-heading`), com peso 500 e espaçamento negativo entre letras. **Inter** no corpo (`font-sans`), com pesos 400, 500 e 600. As duas vêm do Google Fonts, em `index.html`.

| Elemento | Fonte | Tamanho | Espaçamento |
| --- | --- | --- | --- |
| Título da página inicial | Sora 500 | `clamp(2.4rem, 4.8vw, 4.4rem)` | −0,04em |
| Título de página | Sora 500 | 2,25rem, e 3rem a partir de `sm` | −0,04em |
| Título de seção (`.site-title`) | Sora 500 | 1,875rem, e 2,5rem a partir de `md` | −0,035em |
| Rótulo acima do título (`.site-eyebrow`) | Inter 600, maiúsculas | 0,75rem | 0,13em |
| Texto de abertura | Inter 400 | 1rem, e 1,125rem a partir de `sm` | |
| Texto de apoio | Inter 400 | 0,875rem | |

## Componentes base

As classes `site-*` estão em `src/tokens.css`.

| Classe ou peça | Características |
| --- | --- |
| `.site-shell` | Contêiner de até 1200 px, com margem lateral de 24 px (40 px a partir de 768 px) |
| `.site-section` | Espaço vertical de 80 px (96 px a partir de 768 px), alternando fundo branco e `brand-soft` |
| `.site-button` | Botão principal: laranja com texto `brand-ink`, altura mínima de 48 px |
| `.site-link` | Link de texto: azul, sublinhado ao passar o mouse, altura mínima de 44 px |
| Cartão | Borda `border`, fundo branco, `rounded-md` |
| Cabeçalho público | Fixo, com 64 px de altura (72 px a partir de 768 px). Transparente só sobre a foto da página inicial, com a página no topo |
| Rodapé | Fundo `brand-deep`, logo e colunas de contato e horários |
| Ícones | Lucide, de 16 a 20 px, na cor do texto |

Os raios são `rounded-sm` (6 px) no botão, `rounded-md` (8 px) nos cartões e `rounded-full` nos selos de status.

## Gráficos

Os gráficos usam o Recharts e seguem estas regras:

- **Consumo × geração:** azul `#384C96` para o consumo e laranja `#D88739` para a geração, combinação conferida para daltonismo.
- **Saldo acumulado:** uma série só, em cinza `#9AA3B5` enquanto o investimento se paga e em azul depois. A posição acima ou abaixo do zero já indica isso, e a cor só reforça.
- **Sempre há tabela alternativa:** o laranja e o cinza têm contraste abaixo de 3:1 com o fundo, então “Ver mês a mês” e “Ver ano a ano” trazem os mesmos números.
- **Texto na cor de texto:** valores, eixos e legendas usam as cores de texto, nunca a cor da série. O quadrado da legenda identifica a série.
- **Barras finas e grade discreta:** largura máxima de 18 px, com pontas arredondadas e linhas de grade em `#D9DDE6`.
- **Dica ao passar o mouse:** cada barra mostra o valor exato.
- Cada gráfico tem `role="img"` e um `aria-label` que descreve o conteúdo e aponta para a tabela.

## Fotografias

São 11 fotos do acervo da Don Energy, cada uma em três larguras. A imagem do topo da página inicial é um recorte próprio em AVIF e WebP.

- A autorização de uso foi dada para o site da Don Energy. Antes de usar as fotos em outro projeto, confirme com a empresa.
- **11 fotos não significam 11 obras.** Não atribua a elas cidade, potência, tipo de cliente ou contagem de projetos sem dado confirmado.
- A legenda padrão é “Instalação solar · Acervo Don Energy”. Os textos alternativos ficam em `src/dados/fotos.ts`.

## Acessibilidade visual

- Foco visível com contorno de 3 px na cor do texto, afastado 4 px.
- Alvos de toque com pelo menos 44 px.
- Com `prefers-reduced-motion`, a rolagem suave e as transições ficam desligadas.

As demais regras de acessibilidade estão em [Convenções](convencoes.md#acessibilidade).
