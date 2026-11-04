// Registro dos módulos: funcionalidades novas entram por aqui, sem alterar o núcleo.
import type { Router } from 'express';
import type { JobDeImportacao } from '../jobs/tipos.ts';

// Ponto de extensão: cada módulo acrescenta uma linha com o próprio router.
// As rotas ficam em /api/<modulo>/… (públicas) ou /api/admin/<modulo>/… (restritas).
export const routersDosModulos: Router[] = [
];

// Ponto de extensão: importações agendadas dos módulos (uma linha por job). Rodam no mesmo agendador
// do núcleo, ficam registradas na tabela importacao e aparecem em GET /api/admin/importacoes.
export const jobsDosModulos: JobDeImportacao[] = [
];
