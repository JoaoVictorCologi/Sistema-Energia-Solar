// Usuários da área restrita. As regras de quem pode o quê ficam no service.
import type { Request, Response } from 'express';
import { z } from 'zod';
import { usuarioDaSessao } from '../middlewares/autenticar.ts';
import { lerEntrada } from '../middlewares/validar.ts';
import { alterarUsuario, cadastrarUsuario, consultarUsuarios, excluirUsuario, redefinirSenha } from '../services/usuariosService.ts';

const esquemaId = z.object({ id: z.coerce.number().int().positive() });
const nome = z.string().trim().min(2, 'Informe o nome.').max(120, 'Nome longo demais.');
const email = z.email('E-mail inválido.').max(254, 'E-mail longo demais.').transform((valor) => valor.toLowerCase());
// O bcrypt só considera os primeiros 72 bytes da senha.
const senha = z.string().min(10, 'A senha precisa ter pelo menos 10 caracteres.').max(72, 'A senha pode ter no máximo 72 caracteres.');
// O papel admin não entra aqui: a conta da TI só é criada por linha de comando.
const papel = z.enum(['gestor', 'operador']);

export const esquemaNovoUsuario = z.object({ nome, email, senha, papel });
export const esquemaMudancaDeUsuario = z.object({ nome: nome.optional(), email: email.optional(), papel: papel.optional() })
  .refine((mudanca) => Object.keys(mudanca).length > 0, { message: 'Informe o que mudar.', path: ['corpo'] });
export const esquemaNovaSenha = z.object({ senha });

export async function listarUsuarios(_requisicao: Request, resposta: Response): Promise<void> {
  resposta.json({ usuarios: await consultarUsuarios(usuarioDaSessao(resposta)) });
}

export async function criarUsuario(requisicao: Request, resposta: Response): Promise<void> {
  const usuario = await cadastrarUsuario(usuarioDaSessao(resposta), requisicao.body as z.infer<typeof esquemaNovoUsuario>);
  resposta.status(201).json({ usuario });
}

export async function editarUsuario(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaId, requisicao.params);
  resposta.json({ usuario: await alterarUsuario(usuarioDaSessao(resposta), id, requisicao.body as z.infer<typeof esquemaMudancaDeUsuario>) });
}

export async function trocarSenhaDoUsuario(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaId, requisicao.params);
  await redefinirSenha(id, (requisicao.body as z.infer<typeof esquemaNovaSenha>).senha);
  resposta.status(204).end();
}

export async function removerUsuario(requisicao: Request, resposta: Response): Promise<void> {
  const { id } = lerEntrada(esquemaId, requisicao.params);
  await excluirUsuario(usuarioDaSessao(resposta), id);
  resposta.status(204).end();
}
