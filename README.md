# Don Energy — Site institucional

Next.js 16.2.10 (App Router), React 19, TypeScript e Tailwind CSS 4. Exportação estática, conteúdo local e atendimento pelo WhatsApp. Sem backend, API, banco ou envio automático.

## Estado vigente e preservação

- E1 validada: `e5c4234`. E2 visual validada: `93e0754`.
- E3 em `944c461`: **entrega parcial validada, com detalhes das obras pendentes do proprietário**.
- E4 em `205dbbf`: **interface validada; cálculo pendente de aprovação técnica em Q07-A**. O simulador não calcula estimativas.
- E5: consolidação autorizada na branch `etapa/e5-consolidacao-visual`, base `205dbbf`, aguardando avaliação da entrega. Não fazer push, merge, deploy ou avançar para publicação por inferência.

A central do projeto fica em `C:/Users/colog/Documents/Obsidian Vault/Don-Energy-Site/00-Painel.md`. Consultar `Etapas/E5-Reformulacao-visual.md` e `Materiais/Referencias/E5/` para evidências, commits, limitações e rollback. Questões comerciais/técnicas centralizadas em `Confirmacoes-do-proprietario.md`. Guias anteriores preservados no histórico Git, sem prevalecer sobre este estado.

## Ambiente e comandos

Node 24.11.0 (`.nvmrc`), npm 11.6.1. Preservar lockfile; não atualizar dependências automaticamente.

```powershell
npm ci
npm run dev
npm run lint
npm run build
npm run preview:static
```

O build gera `out/`. A prévia estática serve `http://127.0.0.1:4173/` em loopback, com gzip para texto e status 404 real. `next start` não serve exportação estática. Medir desempenho no build de produção, sem `next dev`.

## Páginas, conteúdo e identidade

Dez rotas: `/`, `/servicos/`, `/servicos/solar-residencial/`, `/servicos/solar-comercial/`, `/servicos/solar-rural/`, `/servicos/usina-de-investimento/`, `/obras/`, `/simulador/`, `/contato/`, `/privacidade/`. Mais `404.html`, robots e sitemap. `trailingSlash: true`, `output: export`, imagens locais com `unoptimized: true`; preparar derivados antes do build.

- `lib/site-config.ts`: única fonte de URL, marca, telefone, endereço, horários e imagem social. `contato-data.ts` é uma fachada. URL configurada: `https://don-energy.vercel.app`; não presumir que configuração local confirma o destino de deploy. Números institucionais não confirmados não são exibidos.
- Marca D25 sem “Energia solar” embaixo ou ao lado. Derivação nativa 834 × 558, transparência e proporções preservadas; originais e versões históricas mantidos. Não ampliar o raster compacto nem reconstruir por IA.
- Sora/Inter, azul e laranja, base clara e azul profundo de apoio. Header 64/72 px, transparente apenas na inicial no topo; sólido após 16 px, menu aberto e desde o início nas internas. Preservar reserva de altura e padding do Hero. CTAs laranja usam texto escuro.
- Fotografias atuais autorizadas (D27), sem classificação por serviço, cidade, potência ou quantidade de obras presumidas. `lib/fotos-data.ts` organiza arquivos; `lib/obras-data.ts` organiza projetos confirmados e continua vazio. A estrutura `DetalheObra` não cria rota pública. Onze fotos não são onze obras. Sem filtros até dados confirmados.
- `public/obras/` preserva fontes; `otimizadas/` contém variantes E2 e Hero AVIF/WebP; `portfolio/` contém variantes 480/960/1440 derivadas das fontes, com ampliação integral. `sizes` sem srcSet não gera variantes no export.
- Depoimentos preservados em `lib/depoimentos-data.ts`, fora do HTML/bundle público até origem e autorização. Integração automática Google adiada. Sem promessas comerciais, técnicas ou financeiras não confirmadas.

## Navegação e fluxos preservados

Menu: Início, Soluções, Projetos, Simulador e Contato. Base UI móvel carrega sob demanda; preservar teclado/Escape/foco e redimensionamento. Ampliação do portfólio carrega diálogo sob demanda; sem JS, abre o arquivo da foto.

Formulário RHF/Zod compartilhado. `?servico=solar-residencial` aceita apenas os quatro slugs; valores desconhecidos são ignorados. Não colocar dados pessoais em URLs internas. Consentimento obrigatório; mensagem preparada abre WhatsApp e o visitante decide enviar. Testes interceptam destinos e usam dados fictícios. Fallback de WhatsApp permanece sem JS; o atalho flutuante só aparece onde previsto e não cobre o formulário.

E4 mostra “Cálculo em preparação” desde o início. Ação principal “Revisar dados”; validação sintática sob demanda, revisão/edição e contato opcional. Sem fórmulas, parâmetros presumidos, conversão R$→kWh, estimativas ou projeções de retorno. Usina tem tratamento próprio. Contexto em memória; atualizar contato exige ação explícita, preservando rascunho e invalidando mensagem antiga quando necessário. Sem persistência em URL/localStorage.

Mapa só carrega após “Carregar mapa”; “Como chegar” abre rotas para o endereço central. Localização confirmada pelo usuário em D27. Sem SDK, API key ou geolocalização. A política descreve conexões com Google e WhatsApp.

## Qualidade, SEO e publicação posterior

Rodar lint, TypeScript/build/export e regressões proporcionais. Auditar as dez páginas em Lighthouse 13.5.0, três amostras por perfil, medianas/faixas; E5 concentra 60 auditorias finais depois de estabilizar. Registrar LCP/CLS e limitações; localhost não comprova Core Web Vitals de campo, Vercel ou Hostinger. Conferir teclado, 320 px, zoom 200%, densidade 2×, 404 e fluxos além da auditoria automática.

Metadados/canonicals/sitemap usam `SITE_URL`. Robots permite indexação no ambiente configurado. Ambiente de avaliação e sua indexação devem ser decididos antes de publicar. Não gerar links para páginas inexistentes nem Review/AggregateRating sem autorização.

Git/Vercel é um marco separado: conferir remoto atual, projeto/conta, repositório vinculado, branch de produção, gatilhos, build/saída, URL, proteção/indexação e deployment anterior. Sem vincular projeto, reconfigurar ou publicar nesta entrega.

Hostinger posterior: confirmar plano com arquivos próprios, domínio, diretório, HTTPS, compressão/cache e 404; não presumir Node nem recursos do Criador de Sites. Enviar apenas `out/` mediante autorização, preservar DNS/e-mail e backup completo. Testar dez rotas, atualização direta, ativos, 404, contatos e avisos E3/E4 na URL real. Cache imutável apenas para ativos com hash; HTML/robots/sitemap devem revalidar. Não criar `.htaccess` antes de conhecer o servidor.

## Rollback

E5 retorna à árvore aceita `205dbbf`, por revert dos commits E5 em ordem inversa, com branch/HEAD/árvore limpa conferidos. Preservar qualquer trabalho posterior antes de replanejar; sem reset ou exclusão recursiva. Recriar `out/` e revalidar fluxos. Não usar rollback E4→E3 para desfazer E5. O script/dry-run e a lista real de commits ficam no vault. Restaurar deployment é operação diferente, sujeita ao destino e autorização do marco seguinte.
