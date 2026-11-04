// Ponto de entrada do processo: valida a configuração, sobe a API e liga o agendador de importações.
import { ErroDeConfiguracao, obterEnv, type Env } from './config/env.ts';

// Configuração errada encerra o processo com uma mensagem clara, em vez de falhar na primeira requisição.
function validarConfiguracao(): Env {
  try {
    return obterEnv();
  } catch (erro) {
    if (!(erro instanceof ErroDeConfiguracao)) throw erro;
    console.error(erro.message);
    process.exit(1);
  }
}

const env = validarConfiguracao();

// Importados só depois da validação, porque a conexão com o banco lê o ambiente ao ser carregada.
const { criarApp } = await import('./app.ts');
const { iniciarAgendador } = await import('./jobs/agendador.ts');

criarApp().listen(env.PORT, () => {
  console.log(`API do Solar Gestão em http://localhost:${env.PORT}`);
});
// Importações agendadas de dados (ANEEL, Banco Central e módulos), no fuso de São Paulo.
iniciarAgendador();
