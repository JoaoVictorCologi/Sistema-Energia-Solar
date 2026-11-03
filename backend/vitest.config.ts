import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // .env de teste: nenhum teste abre conexão com este banco; os repositories são simulados.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://teste:teste@localhost:5432/solar_gestao_teste',
      JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
    },
  },
});
