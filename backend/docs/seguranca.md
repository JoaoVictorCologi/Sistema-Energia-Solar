# Segurança e privacidade

## Autenticação

- **Login:** `POST /api/auth/login` confere a senha com bcrypt (custo 12). E-mail errado e senha errada recebem a mesma resposta. A comparação roda mesmo quando o e-mail não existe, para o tempo de resposta não revelar quais e-mails estão cadastrados.
- **Limite:** 5 tentativas a cada 15 minutos por IP.
- **Sessão:** JWT (HS256) de 8 horas, que guarda só o id e o papel, sem dados pessoais, assinado com `JWT_SECRET`.
- **Cookie `sessao`:**
  - `HttpOnly`: o JavaScript da página não lê o token;
  - `SameSite=Lax`: outro site não envia o cookie num POST;
  - `Secure` em produção.
- **Senhas:** de 10 a 72 caracteres, porque o bcrypt só considera os primeiros 72 bytes. Nunca aparecem na tela, nos logs ou nas respostas: `senha_hash` só é lida na consulta do login.

## Papéis

| Papel | Quem é | Como nasce |
| --- | --- | --- |
| `admin` | A TI | Só por `npm run criar-admin` |
| `gestor` | Administra a operação | Criado pelo admin |
| `operador` | Atende clientes e orça | Criado pelo admin ou por um gestor |

| Ação | `admin` | `gestor` | `operador` |
| --- | --- | --- | --- |
| Painel, clientes e simulações | Sim | Sim | Sim |
| Orçamentos: criar, editar, enviar, mudar status | Sim | Sim | Sim |
| Ler catálogo, configuração e formas de pagamento | Sim | Sim | Sim |
| Alterar catálogo, configuração e formas de pagamento | Sim | Sim | Não |
| Listar, criar, editar e excluir usuários | Sim | Sim | Não |
| Criar ou promover um gestor | Sim | Não | Não |
| Ver a conta do admin na lista | Sim | Não | Não |
| Importações de dados | Sim | Não | Não |

Regras sobre contas:

- A conta `admin` não é alterada pela API, nem por ela mesma.
- O gestor pode alterar e excluir outros gestores e operadores.
- Ninguém exclui a própria conta (`409 EXCLUSAO_DA_PROPRIA_CONTA`).
- Excluir desativa a conta: ela segue no histórico, e o e-mail não pode ser usado de novo.

**O papel que vale é o do banco**, lido a cada requisição, não o do token. Excluir ou rebaixar um usuário tem efeito na hora, mesmo com a sessão aberta.

## Proteção das rotas

Toda rota `/api/admin/*` usa `autenticar` seguido de um papel:

```ts
rotas.get('/admin/clientes', autenticar, exigirEquipe, listarClientes);          // admin, gestor, operador
rotas.patch('/admin/configuracoes-comerciais', autenticar, exigirGestao, validar(esquema), editarConfiguracao); // admin, gestor
rotas.post('/admin/importacoes/:tipo', autenticar, exigirAdmin, rodarImportacao); // só admin
```

- `autenticar` lê o cookie, confere o usuário no banco e põe `{ id, papel }` em `res.locals.usuario`.
- `usuarioDaSessao(resposta)` devolve quem fez a requisição, nos controllers.
- Sem sessão, a resposta é 401; sem o papel, é 403.

## Validação de entrada

Toda entrada (body, query, params) passa por zod. Campos não declarados são **sempre recusados**, o que impede o site de enviar preços ou premissas: preço e cálculo só existem no backend.

## Limites de requisição

| Rota | Limite por IP |
| --- | --- |
| `POST /auth/login` | 5 a cada 15 min |
| `POST /clientes` | 5 por minuto |
| `GET /cep/:cep`, `GET /formas-pagamento`, `POST /simulacoes` | 30 por minuto, cada uma |
| `GET /health` | Sem limite, porque o monitoramento consulta o tempo todo |

Quem passa do limite recebe `429 MUITAS_REQUISICOES`. A contagem fica em memória, por processo ([implantacao.md](implantacao.md#limites)). Para limites novos, use `criarLimite({ janelaMs, maximo })` dentro da função que monta o router, para cada app e cada teste começarem do zero.

## Cabeçalhos e origem

- **helmet:** a política padrão, mais o iframe do mapa da página de contato (`frame-src` com `maps.google.com` e `www.google.com`).
- **CORS:** aceita só `URL_FRONTEND`, com credenciais.
- **Corpo:** limitado a 100 kB.
- **`trust proxy`:** ligado em produção, assumindo um proxy na frente. É dele que vem o IP real usado nos limites.

## Banco e erros

- Consultas pelo construtor do Knex. `knex.raw` só com parâmetros.
- Colunas sempre explícitas, nunca a linha inteira.
- Erro inesperado responde `500` genérico. O log guarda só a pilha, sem o objeto do erro, que pode trazer dados do banco.
- O id sequencial de simulações não sai do backend: o acesso público usa um UUID.
- Falha de integração informa só o domínio e o motivo, sem a URL.

## Segredos

`DATABASE_URL` e `JWT_SECRET` ficam só no `.env`, ignorado pelo Git. Só o modelo `.env.example` vai para o repositório. Trocar o `JWT_SECRET` derruba todas as sessões abertas.

## Privacidade (LGPD)

| Dado | Onde fica | Regra |
| --- | --- | --- |
| Nome, e-mail, telefone, CEP | `cliente` | Só existe com o aceite do uso dos dados; a data fica em `aceite_em` |
| Endereço, contato preferido, melhor horário | `cliente` | Opcionais. O endereço nunca entra na simulação nem no cache |
| Autorização para calibração | `cliente.autoriza_calibracao` | Consentimento separado do aceite: sem ele, o pedido segue normal |
| Consumo e respostas do telhado | `simulacao` | Sem nome: só se liga a uma pessoa se houver pedido de proposta |
| CEP consultado | `cep_cache` | Só CEP e município |

- A resposta de `POST /clientes` não devolve dados do cliente.
- Dados de clientes só saem nas rotas restritas.
- A base de usinas da ANEEL, que traz CPF e CNPJ de titulares, não é importada.
- Contas de luz usadas em testes ficam no repositório sem nome, CPF, endereço ou número da instalação ([testes.md](testes.md#validação-com-contas-reais)).
- O site precisa citar na política de privacidade os dados listados acima.

## Limites conhecidos

- Trocar a senha de um usuário não derruba as sessões já abertas: o token vale até expirar. Excluir ou mudar o papel tem efeito na hora.
- Não há rota para cada usuário trocar a própria senha informando a atual. O operador depende de um gestor ou do admin. O gestor consegue pela rota geral de usuários, sem informar a senha atual. A senha do `admin` não muda pela API.
- Não há rota para excluir ou exportar os dados de um cliente: hoje, atender um pedido do titular exige acesso ao banco.
- Não há política de retenção: simulações sem pedido de proposta ficam guardadas indefinidamente.
- As rotas restritas não têm limite de requisições, além da exigência de sessão.
- Não há registro de auditoria para login nem para mudanças em usuários. Orçamentos e configuração comercial têm histórico.
