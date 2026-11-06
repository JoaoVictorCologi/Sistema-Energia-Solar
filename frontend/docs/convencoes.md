# Convenções

## Código

- **Português:** nomes de variáveis, funções, componentes e arquivos em português, claros e completos (`formatarDataEHora`, não `fmtDH`). Termos técnicos do React e do JavaScript seguem como são.
- **Funções curtas:** até cerca de 40 linhas, com uma responsabilidade. Componentes longos viram componentes menores no mesmo arquivo.
- **Comentários:** dizem a responsabilidade de um arquivo ou função quando o nome não basta e explicam o porquê das decisões, não o que a linha faz. Têm tom técnico e impessoal e citam apenas o que está no repositório.
- **Sem código morto:** nada de código comentado, importações sobrando ou `console.log` esquecido. O TypeScript recusa variáveis e parâmetros não usados.
- **Bibliotecas novas:** são decisão da equipe. Antes de acrescentar uma, veja se o que já existe resolve.

## TypeScript

A configuração é estrita e usa `verbatimModuleSyntax` e `erasableSyntaxOnly`:

- importações relativas levam a extensão: `from '../services/api.ts'`;
- importação só de tipo usa `import type` ou `type` dentro das chaves;
- nada de `enum`, `namespace` nem propriedades declaradas no construtor;
- componentes são exportados por nome: `export function Painel()`.

## Regras do domínio

- **Preço e cálculo são do backend.** O frontend envia só os dados e as escolhas, e nunca valores calculados.
- **A tela não substitui a API.** Esconder um botão não protege nada: a permissão é conferida no backend.
- **Sem segredos:** nada de chaves ou tokens no código do frontend. Tudo o que está aqui chega ao navegador do visitante.
- **Datas:** o backend guarda em UTC; a tela mostra no horário de São Paulo.
- **Formatação:** dinheiro, números e datas passam por `src/utils/formatar.ts`.
- **Leitura de campos:** números digitados passam por `src/utils/numeros.ts`.

## Estilos

Use as classes do Tailwind e os tokens de `src/tokens.css`, sem cores soltas em novos componentes. A exceção são os gráficos e as ilustrações em SVG, que recebem a cor por propriedade. Detalhes em [Identidade visual](identidade-visual.md).

O desenho é pensado primeiro para o celular. Nenhuma tela pode ter rolagem lateral em 360 px: tabelas largas ficam em um contêiner com `overflow-x-auto`.

## Peças reutilizáveis

Antes de criar algo novo, veja se já existe.

### Formulários: `src/components/formulario/Campos.tsx`

| Peça | Uso |
| --- | --- |
| `CampoDeTexto` | Campo com rótulo, ajuda e erro ligados ao campo |
| `CampoDeSelecao` | Lista de opções, com os mesmos recursos |
| `CampoDeAreaDeTexto` | Texto em várias linhas |
| `GrupoDeOpcoes` | Rádios em cartões. Com rótulo longo, fica em uma coluna no celular |
| `CaixaDeAceite` | Caixa de marcação para aceites e opções |
| `MensagemDeErro` e `classeDoCampo` | Para montar um campo próprio |

### Área restrita: `src/components/admin/Pecas.tsx`

| Peça | Uso |
| --- | --- |
| `Titulo` | Título da tela, com rótulo e ações |
| `EstadoDaCarga` | Carregando e erro, com “Tentar de novo” |
| `Aviso` | Mensagem de erro geral |
| `Cartao` | Caixa de conteúdo |
| `SeloDeStatus` | Status do orçamento, com ícone e texto |
| `Tabela` e `Paginacao` | Listas |
| `BotaoComConfirmacao` | Ação que não dá para desfazer |

### Hooks: `src/hooks/`

| Hook | Uso |
| --- | --- |
| `useCarregar(buscar, chave)` | Busca dados; repete quando a chave muda; ignora respostas atrasadas. Devolve `dados`, `erro`, `carregando` e `recarregar` |
| `useAcao()` | Ação de botão ou formulário. Devolve `executar`, `ocupado` e `erro` |
| `useTituloDaPagina(titulo)` | Título da aba: `— Don Energy` no site e `— Solar Gestão` na área restrita |

### Utilitários: `src/utils/`

| Arquivo | Funções |
| --- | --- |
| `formatar.ts` | `formatarReais`, `formatarReaisCurto`, `formatarNumero`, `formatarPercentual`, `formatarAnos`, `rotuloDoMes`, `formatarData`, `formatarDataEHora`, `formatarDiaDoInstante` |
| `numeros.ts` | `lerNumero`, `lerNumeroOpcional`, `percentualParaFracao`, `fracaoParaCampo` |
| `papeis.ts` | `temAcesso`, `ehDaEquipe`, `ROTULOS_DO_PAPEL` |

## Acessibilidade

- **Formulários:** todo campo tem rótulo visível, e o erro é ligado ao campo por `aria-describedby`, com `aria-invalid`.
- **Foco e teclado:** tudo funciona pelo teclado, com foco visível. Os elementos interativos são `button`, `a`, `details` ou `dialog`, nunca `div` clicável.
- **Cor nunca sozinha:** status, erros e alertas têm ícone ou texto além da cor.
- **Alvos de toque:** pelo menos 44 px.
- **Avisos dinâmicos:** usam `role="status"` ou `role="alert"`.
- **Imagens:** texto alternativo descritivo, ou `alt=""` e `aria-hidden` quando são decorativas.
- **Gráficos:** sempre com tabela equivalente na mesma tela.
- **Estrutura:** um `h1` por página, com link “Pular para o conteúdo” nos layouts.

## Como acrescentar

### Uma página pública

1. Crie a página em `src/pages/publico/` e chame `useTituloDaPagina`.
2. Registre a rota em `rotasPublicas`, no `src/App.tsx`.
3. Se precisar de menu, acrescente em `menuDoNucleo`, no `src/components/publico/Cabecalho.tsx`.
4. Comece o conteúdo com `<section className="site-shell …">`. O cabeçalho é fixo e nas páginas internas já há um espaço reservado para ele.

### Uma tela da área restrita

1. Crie a tela em `src/pages/admin/` usando as peças de `Pecas.tsx`.
2. Registre a rota em `telasDoNucleo`, no `src/App.tsx`. Se for restrita a um nível, coloque-a dentro da `RotaDoNivel` correspondente.
3. Acrescente o item em `menuDoNucleo`, no `src/pages/admin/LayoutAdmin.tsx`, com o nível de acesso.

### Um módulo

Siga [Módulos](arquitetura.md#módulos). Enquanto a API não existe, a rota pode apontar para `<EmConstrucao />`, para a navegação ficar pronta.

### Antes de entregar

1. `npm run build` sem erros.
2. Conferência no navegador pelo [roteiro de testes](testes-manuais.md), inclusive em 360 px e sem erros no console.
3. Documentação atualizada.
