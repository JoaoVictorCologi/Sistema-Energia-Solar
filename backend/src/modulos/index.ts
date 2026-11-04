import type { Router } from 'express';
import type { JobDeImportacao } from '../jobs/tipos.ts';
import { rotasUsinas } from './usinas/routes.ts';

// PONTO DE EXTENSÃO: cada módulo (Plano 2 em diante) acrescenta uma linha com o próprio router.
// As rotas ficam em /api/<modulo>/… (públicas) ou /api/admin/<modulo>/… (restritas).
export const routersDosModulos: Router[] = [
  rotasUsinas,
];

// PONTO DE EXTENSÃO: importações agendadas dos módulos (uma linha por job). Rodam no mesmo agendador
// do núcleo, ficam registradas na tabela importacao e aparecem em GET /api/admin/importacoes.
export const jobsDosModulos: JobDeImportacao[] = [
];
