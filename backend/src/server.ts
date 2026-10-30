import { ErroDeConfiguracao, lerEnv, type Env } from './config/env.ts';

function validarConfiguracao(): Env {
  try {
    return lerEnv(process.env);
  } catch (erro) {
    if (!(erro instanceof ErroDeConfiguracao)) throw erro;
    console.error(erro.message);
    process.exit(1);
  }
}

const env = validarConfiguracao();

// Importado só depois da validação, porque a conexão com o banco lê o .env ao ser carregada.
const { criarApp } = await import('./app.ts');

criarApp().listen(env.PORT, () => {
  console.log(`API do Solar Gestão em http://localhost:${env.PORT}`);
});
