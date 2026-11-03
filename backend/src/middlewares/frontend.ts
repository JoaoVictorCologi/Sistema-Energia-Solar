import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';

// Em produção o Express entrega o build do React: site e API na mesma origem, então o cookie
// de sessão e o CORS funcionam sem configuração extra. Rotas da tela (/simulador, /admin…) voltam o index.html.
export function entregarFrontend(pasta: string): Router | null {
  const indice = path.join(pasta, 'index.html');
  if (!existsSync(indice)) return null;

  const rotas = Router();
  rotas.use(express.static(pasta, {
    index: false,
    // Arquivos de /assets têm hash no nome: podem ficar em cache para sempre.
    setHeaders: (resposta, arquivo) => {
      if (arquivo.includes(`${path.sep}assets${path.sep}`)) resposta.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));
  rotas.get('/{*caminho}', (_requisicao, resposta) => {
    resposta.setHeader('Cache-Control', 'no-cache');
    resposta.sendFile(indice);
  });
  return rotas;
}
