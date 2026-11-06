# Arquitetura

## Visão geral

```
Navegador
  └─ React Router (src/App.tsx)
       ├─ LayoutPublico → páginas do site e do simulador
       └─ AuthProvider → RotaProtegida → LayoutAdmin → telas da área restrita
            └─ cada tela chama src/services/api.ts
                 └─ /api → backend (Express)
```

Três princípios orientam o código:

1. **O backend decide.** Preço, cálculo, permissão e validação definitiva ficam na API. A tela confere os campos antes de enviar só para responder mais rápido, e a API confere de novo.
2. **O frontend só exibe números.** Os valores chegam prontos e arredondados, e `src/utils/formatar.ts` cuida da apresentação. As poucas contas feitas na tela servem apenas à exibição e estão listadas em [Simulador](simulador.md#contas-feitas-na-tela).
3. **Uma camada para falar com a API.** Nenhuma tela usa `fetch` diretamente: tudo passa por `src/services/api.ts`.

## Estrutura de pastas

```
frontend/
├─ docs/                    # esta documentação
├─ index.html               # fontes (Google Fonts), ícones e elemento #raiz
├─ public/                  # logo, ícones e fotos, servidos sem processamento
├─ vite.config.ts           # plugins e proxy de /api
└─ src/
   ├─ main.tsx              # ponto de entrada
   ├─ App.tsx               # todas as rotas
   ├─ index.css             # importa o Tailwind e os tokens
   ├─ tokens.css            # identidade visual e classes site-*
   ├─ services/api.ts       # todas as chamadas ao backend e os tipos da API
   ├─ contexts/             # AuthContext: quem está logado
   ├─ hooks/                # useCarregar, useAcao, useTituloDaPagina
   ├─ utils/                # formatar (exibição), numeros (leitura de campos), papeis (acesso)
   ├─ dados/                # textos e dados fixos: empresa, soluções, fotos, opções do simulador
   ├─ components/
   │  ├─ RotaProtegida.tsx  # guarda das rotas restritas
   │  ├─ EmConstrucao.tsx   # tela provisória de módulos
   │  ├─ formulario/        # campos usados em todos os formulários
   │  ├─ publico/           # cabeçalho, rodapé, menu móvel, galeria e peças do site
   │  ├─ simulador/         # formulário, resultado, gráficos e pedido de proposta
   │  └─ admin/             # peças da área restrita e editor do orçamento (orcamento/)
   ├─ pages/
   │  ├─ publico/           # páginas do site e do simulador
   │  └─ admin/             # telas da área restrita
   └─ modulos/
      ├─ index.ts           # ponto de extensão: rotas e menus dos módulos
      └─ <nome>/            # um módulo: usinas, catalogo, desempenho, tarifas, site
```

## Rotas

Todas as rotas são declaradas em `src/App.tsx`. Os módulos acrescentam as suas por `src/modulos/index.ts`.

### Públicas

Ficam dentro do `LayoutPublico`, que traz cabeçalho, rodapé, botão flutuante do WhatsApp e o link “Pular para o conteúdo”.

| Rota | Tela | Origem |
| --- | --- | --- |
| `/` | Início | Módulo `site` |
| `/solucoes` | Lista de soluções | Núcleo |
| `/solucoes/:slug` | Detalhe de uma solução | Núcleo |
| `/projetos` | Galeria de fotos | Núcleo |
| `/simulador` | Formulário do simulador | Núcleo |
| `/simulador/resultado` | Resultado da simulação (sob demanda) | Núcleo |
| `/metodologia` | Como o cálculo é feito e as fontes | Núcleo |
| `/contato` | Contato e mapa | Módulo `site` |
| `/privacidade` | Política de privacidade | Núcleo |
| `*` | Página não encontrada | Núcleo |

O menu público segue o campo `ordem`: Início (10), Soluções (20), Projetos (30), Simulador (40) e Contato (90). Se nenhum módulo registrar a rota `/`, ela redireciona para `/simulador`.

### Área restrita

O nível indica quem acessa: **equipe** (admin, gestor e operador), **gestão** (admin e gestor) ou **admin**. Detalhes em [Área restrita](area-restrita.md#papéis).

| Rota | Tela | Nível |
| --- | --- | --- |
| `/admin/login` | Login | Público |
| `/admin` | Painel | Equipe |
| `/admin/clientes` e `/admin/clientes/:id` | Clientes e detalhe | Equipe |
| `/admin/simulacoes` | Simulações | Equipe |
| `/admin/propostas` e `/admin/propostas/:id` | Orçamentos e editor (sob demanda) | Equipe |
| `/admin/equipamentos` | Catálogo com preço | Gestão |
| `/admin/configuracoes` | Configuração comercial e formas de pagamento | Gestão |
| `/admin/usuarios` | Usuários | Gestão |
| `/admin/importacoes` | Importações de dados | Admin |
| `/admin/usinas`, `/admin/catalogo`, `/admin/desempenho`, `/admin/tarifas`, `/admin/mensagens` | Telas provisórias de módulos | Equipe |

A tela chama “orçamento” o que a API e as rotas chamam de `proposta`.

### Guardas de rota

Ambas estão em `src/components/RotaProtegida.tsx`:

- `RotaProtegida`: sem sessão da equipe, leva ao login e guarda a página pedida para voltar depois.
- `RotaDoNivel`: com sessão, mas sem o papel necessário, mostra “Sem permissão”.

Essas guardas só organizam a navegação. A proteção real é a API, que responde 401 ou 403.

## Carregamento sob demanda

As telas com gráfico carregam o Recharts, a maior dependência. Por isso o resultado da simulação e o editor do orçamento usam `lazy` nas rotas e chegam só quando abertas. Enquanto o código não chega na primeira abertura, a rota raiz mostra o `HydrateFallback` (“Carregando…”).

## Estado

Não há biblioteca de estado global. Cada dado fica onde faz mais sentido:

| Onde | O que guarda | Exemplo |
| --- | --- | --- |
| `useState` | Campos e estados locais de uma tela | Formulários |
| `useCarregar` | Dados buscados da API, com carregando e erro | Listas e detalhes |
| `useAcao` | Uma ação de botão ou formulário, com ocupado e erro | Salvar, enviar, excluir |
| URL (`useSearchParams`) | Filtros e página das listas | Status em Orçamentos, busca em Clientes |
| Estado do histórico | Dados entre o formulário e o resultado do simulador | `EstadoDoResultado` |
| `AuthContext` | Quem está logado, lido de `/api/auth/me` | Nome e papel no cabeçalho da área restrita |

Filtros na URL permitem voltar do detalhe sem perder a lista e abrir uma lista filtrada pelos atalhos do painel.

O `AuthProvider` envolve só as rotas de `/admin`: as páginas públicas não consultam a sessão.

## Módulos

Um módulo é uma parte do sistema que entra sem alterar o núcleo. Ele fica em `src/modulos/<nome>/` e exporta um objeto `ModuloDoFrontend`:

```tsx
export const moduloUsinas: ModuloDoFrontend = {
  rotasAdmin: [{ caminho: '/admin/usinas', elemento: <TelaDeUsinas /> }],
  menuAdmin: [{ rotulo: 'Usinas', caminho: '/admin/usinas' }],
};
```

| Campo | Efeito |
| --- | --- |
| `rotasPublicas` | Entram no layout do site. Caminho completo, como `/sobre` |
| `rotasAdmin` | Entram na área restrita, já protegidas pelo login. Caminho completo, como `/admin/usinas` |
| `menuPublico` e `menuAdmin` | Itens de menu. `ordem` posiciona o item; sem ela, ele vai para o fim |

Para registrar, acrescente o módulo à lista `modulosDoFrontend` em `src/modulos/index.ts`. Um módulo pode importar peças do núcleo (`services`, `components`, `hooks`, `utils`), mas o núcleo não depende de módulos, exceto por esse ponto de registro.

## Build e publicação

`npm run build` confere os tipos e gera `dist/`.

Em produção há um serviço só: o backend Express entrega a API em `/api` e o conteúdo de `frontend/dist` no resto, com as rotas da tela devolvendo o `index.html`. Site e API ficam na mesma origem, sem configuração de CORS ou de cookie no frontend. O `render.yaml` da raiz do repositório descreve o build e a publicação.

Dependências externas carregadas pelo navegador:

- **Google Fonts:** fontes Sora e Inter, em `index.html`.
- **Google Maps:** o mapa de contato só é incorporado quando o visitante clica para exibi-lo.
- **WhatsApp:** links `wa.me`, abertos pelo próprio visitante.
