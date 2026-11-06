# Integração com a API

Todas as chamadas ficam em `src/services/api.ts`, junto com os tipos das respostas. As rotas do backend estão em `backend/src/routes/` e são a referência final do contrato.

## Como uma chamada funciona

A função interna `requisitar` envia a requisição para `/api` + caminho e trata a resposta:

| Situação | Resultado |
| --- | --- |
| Sucesso com corpo | Devolve o JSON |
| Status 204 | Devolve vazio |
| Status de erro | Lança `ErroDaApi` com `status`, `codigo`, a mensagem e `campos` |
| Sem conexão com o servidor | Lança `ErroDaApi` com status 0 e código `SEM_CONEXAO` |

## Formato de erro

O backend responde sempre neste formato:

```json
{ "error": { "code": "ENTRADA_INVALIDA", "message": "Dados inválidos. Confira os campos.", "fields": { "email": "E-mail inválido." } } }
```

`fields` aparece em erros de validação, com o caminho do campo como chave (`conta.valorReais`, `telhado.areaM2`, `revisao.performanceRatio`).

Nos formulários:

- havendo `campos`, a mensagem aparece junto do campo correspondente;
- sem `campos`, a mensagem aparece em um aviso geral (`mensagemGeral` em `src/hooks/useAcao.ts`);
- as chaves de erro usadas pela conferência da tela são os mesmos caminhos da API, então os dois erros aparecem no mesmo lugar.

Limites de requisição do backend chegam como erro 429 e a mensagem é mostrada ao usuário. Exemplos: login com 5 tentativas a cada 15 minutos, simulação e CEP com 30 por minuto, pedido de proposta com 5 por minuto.

## Sessão

O login grava um cookie `HttpOnly` chamado `sessao`, enviado pelo navegador automaticamente. O JavaScript nunca lê o token: o `AuthContext` guarda apenas os dados do usuário, consultados em `/api/auth/me`. Essa consulta responder 401 é o caso normal de quem não entrou, e `buscarUsuarioLogado` devolve `null`.

## Valores

- **Dinheiro, tarifa e energia** chegam como número no JSON, já arredondados pelo backend. A tela só formata, por `src/utils/formatar.ts`.
- **Frações:** percentuais trafegam como fração (`0.2` = 20%). `percentualParaFracao` e `fracaoParaCampo`, em `src/utils/numeros.ts`, convertem nos campos da tela.
- **Campos digitados** usam o formato brasileiro: `lerNumero('1.234,56')` devolve `1234.56`.
- **Datas sem hora** chegam como `AAAA-MM-DD` (`formatarData`).
- **Instantes** chegam em UTC e aparecem no horário de São Paulo (`formatarDataEHora`, `formatarDiaDoInstante`).

## Orçamentos antigos

O orçamento é lido de uma cópia gravada, sem recálculo. Orçamentos criados antes das regras de ajustes e condições reabrem como foram gravados, sem alguns campos. Por isso `ajustes`, `condicoes`, `estimadoPeloSimulador`, `configuracaoUsada`, `premissas.origem` e `premissas.telhado` são opcionais no tipo `Proposta`, e as telas tratam a ausência.

## Rotas usadas

### Públicas

| Função | Método e rota | Onde é usada |
| --- | --- | --- |
| `consultarCep` | `GET /cep/:cep` | Formulário do simulador |
| `simular` | `POST /simulacoes` | Formulário do simulador |
| `listarFormasPublicas` | `GET /formas-pagamento` | Pergunta sobre pagamento |
| `pedirProposta` | `POST /clientes` | Pedido de proposta |

### Sessão

| Função | Método e rota | Onde é usada |
| --- | --- | --- |
| `entrar` | `POST /auth/login` | Login |
| `sair` | `POST /auth/logout` | Botão Sair |
| `buscarUsuarioLogado` | `GET /auth/me` | `AuthContext` |

### Atendimento (equipe)

| Função | Método e rota | Onde é usada |
| --- | --- | --- |
| `buscarPainel` | `GET /admin/painel` | Painel |
| `listarClientes` | `GET /admin/clientes` | Clientes |
| `buscarCliente` | `GET /admin/clientes/:id` | Detalhe do cliente |
| `listarSimulacoes` | `GET /admin/simulacoes` | Simulações |

### Orçamentos (equipe)

Toda alteração devolve o orçamento inteiro, já recalculado, e a tela substitui o que está mostrando.

| Função | Método e rota | Ação |
| --- | --- | --- |
| `gerarProposta` | `POST /admin/propostas` | Cria o rascunho |
| `listarPropostas` | `GET /admin/propostas` | Lista, com filtro de status |
| `buscarProposta` | `GET /admin/propostas/:id` | Abre o orçamento |
| `editarProposta` | `PATCH /admin/propostas/:id` | Equipamentos, revisão e observações |
| `excluirProposta` | `DELETE /admin/propostas/:id` | Exclui um rascunho |
| `adicionarAjuste` | `POST /admin/propostas/:id/ajustes` | Inclui desconto ou acréscimo |
| `removerAjuste` | `DELETE /admin/propostas/:id/ajustes/:itemId` | Remove o ajuste |
| `adicionarCondicao` | `POST /admin/propostas/:id/condicoes` | Inclui condição de pagamento |
| `removerCondicao` | `DELETE /admin/propostas/:id/condicoes/:itemId` | Remove a condição |
| `enviarProposta` | `POST /admin/propostas/:id/enviar` | Envia e congela |
| `mudarStatusDaProposta` | `PATCH /admin/propostas/:id/status` | Marca como enviada, aceita ou recusada |
| `criarNovaVersao` | `POST /admin/propostas/:id/nova-versao` | Cria a versão seguinte, em rascunho |
| `duplicarProposta` | `POST /admin/propostas/:id/duplicar` | Cria outro orçamento a partir deste |

### Catálogo e configurações

A leitura é da equipe, porque o editor do orçamento precisa dela. A alteração é da gestão.

| Função | Método e rota | Onde é usada |
| --- | --- | --- |
| `listarEquipamentos` | `GET /admin/equipamentos` | Equipamentos e orçamentos |
| `cadastrarEquipamento` | `POST /admin/equipamentos` | Equipamentos |
| `alterarEquipamento` | `PATCH /admin/equipamentos/:id` | Equipamentos |
| `buscarConfiguracao` | `GET /admin/configuracoes-comerciais` | Configurações |
| `alterarConfiguracao` | `PATCH /admin/configuracoes-comerciais` | Configurações |
| `listarFormas` | `GET /admin/formas-pagamento` | Configurações e orçamentos |
| `cadastrarForma` | `POST /admin/formas-pagamento` | Configurações |
| `alterarForma` | `PATCH /admin/formas-pagamento/:id` | Configurações |

### Usuários (gestão) e importações (admin)

| Função | Método e rota | Onde é usada |
| --- | --- | --- |
| `listarUsuarios` | `GET /admin/usuarios` | Usuários |
| `cadastrarUsuario` | `POST /admin/usuarios` | Usuários |
| `alterarUsuario` | `PATCH /admin/usuarios/:id` | Usuários |
| `redefinirSenha` | `POST /admin/usuarios/:id/senha` | Usuários |
| `excluirUsuario` | `DELETE /admin/usuarios/:id` | Usuários |
| `listarImportacoes` | `GET /admin/importacoes` | Importações |
| `rodarImportacao` | `POST /admin/importacoes/:tipo` | Importações |

## Como acrescentar uma chamada

1. Declare em `services/api.ts` os tipos da resposta e a função, usando `requisitar`.
2. Em leitura de tela, use `useCarregar(() => minhaFuncao(), chave)`. A busca se repete quando a chave muda, e uma resposta atrasada de uma chave anterior é ignorada.
3. Em ação de botão ou formulário, use `useAcao`. `executar` devolve o resultado, ou `undefined` se falhar, e deixa o erro em `erro`.
4. Atualize a tabela acima.
