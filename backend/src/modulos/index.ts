import type { Router } from 'express';

// PONTO DE EXTENSÃO: cada módulo (Plano 2 em diante) acrescenta uma linha com o próprio router.
// As rotas ficam em /api/<modulo>/… (públicas) ou /api/admin/<modulo>/… (restritas).
export const routersDosModulos: Router[] = [
];
