# Frontend do Solar Gestão

Interface web do Solar Gestão, sistema de energia solar da Don Energy. Reúne três partes em uma única aplicação React:

- **Site público:** páginas institucionais da Don Energy (início, soluções, projetos, contato, privacidade).
- **Simulador:** o visitante informa os dados da casa e vê a economia estimada pelas regras da Lei 14.300, com a opção de pedir uma proposta.
- **Área restrita:** a equipe atende os pedidos, monta orçamentos a partir das simulações e administra as configurações comerciais.

Todo cálculo, preço e regra de negócio fica no backend. O frontend coleta os dados, envia para a API e mostra o resultado.

## Documentação

| Documento | O que explica |
| --- | --- |
| [Arquitetura](arquitetura.md) | Estrutura de pastas, rotas, estado, módulos, build e publicação |
| [Integração com a API](integracao-com-a-api.md) | Como as chamadas são feitas, formato de erro, sessão e a lista de rotas usadas |
| [Simulador](simulador.md) | Formulário, perguntas, validação, resultado e pedido de proposta |
| [Área restrita](area-restrita.md) | Papéis, telas, ciclo do orçamento, impressão e configurações |
| [Identidade visual](identidade-visual.md) | Logo, cores, tipografia, componentes base, gráficos e fotos |
| [Convenções](convencoes.md) | Padrões de código, peças reutilizáveis, acessibilidade e como acrescentar telas |
| [Testes manuais](testes-manuais.md) | Roteiro para conferir o sistema no navegador |

## Tecnologias

| Item | Uso |
| --- | --- |
| React 19 e TypeScript 5.9 | Interface, com checagem estrita de tipos |
| Vite 7 | Servidor de desenvolvimento e build |
| React Router 8 | Rotas, com carregamento sob demanda das telas com gráfico |
| Tailwind CSS 4 | Estilos, a partir dos tokens de `src/tokens.css` |
| Recharts 3 | Gráficos do resultado e do orçamento |
| lucide-react | Ícones |

O gerenciador de pacotes é o npm.

## Como rodar

**Pré-requisitos:** Node 22.18 ou mais novo e o backend rodando em `http://localhost:3333`. O `README.md` da raiz do repositório explica como subir o backend, e as cargas de dados estão em [Testes manuais](testes-manuais.md#preparação).

```
cd frontend
npm install
npm run dev
```

O site abre em `http://localhost:5173`. O Vite repassa as chamadas de `/api` ao backend (ver `vite.config.ts`), então navegador, site e API ficam na mesma origem e o cookie de sessão funciona sem configuração extra.

O frontend não usa variáveis de ambiente nem guarda segredos.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento, com recarga ao salvar |
| `npm run build` | Confere os tipos (`tsc -b`) e gera o site em `dist/` |
| `npm run preview` | Serve localmente o conteúdo de `dist/` |

Para entrar na área restrita, abra `/admin` com um usuário criado no backend (`npm run criar-admin` cria o primeiro).

## Situação das telas

| Parte | Situação |
| --- | --- |
| Site público: início, soluções, projetos, contato, metodologia, privacidade | Pronto. O contato monta a mensagem e abre o WhatsApp, sem gravar dados |
| Simulador, resultado e pedido de proposta | Pronto |
| Painel, clientes, simulações e orçamentos | Pronto |
| Equipamentos, configurações, usuários e importações | Pronto |
| Usinas, catálogo, desempenho, tarifas e mensagens | Provisório: a rota e o item de menu existem e mostram a tela “em construção” até a API correspondente ficar pronta |

## Limitações conhecidas

- **Sem testes automatizados:** a conferência é manual, pelo [roteiro de testes](testes-manuais.md). O build confere os tipos.
- **Sem tela para trocar a própria senha:** a gestão redefine a senha em Usuários.
- **Sessão expirada:** a tela mostra a mensagem de erro da API e não leva sozinha ao login; basta entrar de novo em `/admin/login`.
- **Telas provisórias no menu:** ficam visíveis para todos os papéis até receberem as regras de acesso próprias.

## Como manter esta documentação

Atualize o documento do assunto na mesma entrega da mudança no código. Os casos mais comuns:

- rota ou tela nova: [Arquitetura](arquitetura.md) e a tabela de situação acima;
- chamada de API nova: [Integração com a API](integracao-com-a-api.md);
- pergunta nova no simulador: [Simulador](simulador.md) e a página de Privacidade do site, se for um dado novo;
- regra nova de orçamento ou de papel: [Área restrita](area-restrita.md);
- comportamento novo para conferir: [Testes manuais](testes-manuais.md).

Descreva o que existe hoje. O que ainda não foi feito entra só na tabela de situação ou nas limitações.
