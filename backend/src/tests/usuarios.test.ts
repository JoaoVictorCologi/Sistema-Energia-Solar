import bcrypt from 'bcrypt';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from '../app.ts';
import {
  atualizarSenha, atualizarUsuario, buscarUsuarioPorId, desativarUsuario, existeUsuarioComEmail, inserirUsuario, listarUsuariosAtivos, type UsuarioPublico,
} from '../repositories/usuariosRepository.ts';
import { gerarToken } from '../services/authService.ts';

vi.mock('../repositories/usuariosRepository.ts', () => ({
  buscarUsuarioPorId: vi.fn(), existeUsuarioComEmail: vi.fn(), inserirUsuario: vi.fn(), listarUsuariosAtivos: vi.fn(), atualizarUsuario: vi.fn(),
  atualizarSenha: vi.fn(), desativarUsuario: vi.fn(),
}));

const TI: UsuarioPublico = { id: 1, nome: 'Ana TI', email: 'ti@exemplo.com', papel: 'admin' };
const OLIVIA: UsuarioPublico = { id: 2, nome: 'Olívia', email: 'olivia@exemplo.com', papel: 'operador' };
const GIL: UsuarioPublico = { id: 3, nome: 'Gil', email: 'gil@exemplo.com', papel: 'gestor' };
const BRUNO: UsuarioPublico = { id: 4, nome: 'Bruno', email: 'bruno@exemplo.com', papel: 'operador' };
const ADMIN = `sessao=${gerarToken({ id: 1, papel: 'admin' })}`;
const OPERADOR = `sessao=${gerarToken({ id: 2, papel: 'operador' })}`;
const GESTOR = `sessao=${gerarToken({ id: 3, papel: 'gestor' })}`;
const SENHA = 'senha-forte-do-operador';
const NOVO = { nome: 'Carla', email: 'Carla@Exemplo.com', senha: SENHA, papel: 'operador' };
const ROTA = '/api/admin/usuarios';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buscarUsuarioPorId).mockImplementation(async (id) => [TI, OLIVIA, GIL, BRUNO].find((usuario) => usuario.id === id));
  vi.mocked(existeUsuarioComEmail).mockResolvedValue(false);
  vi.mocked(inserirUsuario).mockImplementation(async ({ nome, email, papel }) => ({ id: 9, nome, email, papel }));
  vi.mocked(atualizarUsuario).mockImplementation(async (id, mudanca) => ({ ...[OLIVIA, GIL, BRUNO].find((usuario) => usuario.id === id)!, ...mudanca }));
});

describe('acesso', () => {
  it.each([['get', ROTA], ['post', ROTA], ['patch', `${ROTA}/4`], ['post', `${ROTA}/4/senha`], ['delete', `${ROTA}/4`]] as const)('%s %s: sem login → 401, operador → 403', async (metodo, rota) => {
    expect((await request(criarApp())[metodo](rota)).status).toBe(401);

    const resposta = await request(criarApp())[metodo](rota).set('Cookie', OPERADOR).send({ senha: SENHA });
    expect(resposta.status).toBe(403);
    expect(resposta.body.error.code).toBe('SEM_PERMISSAO');
    expect(inserirUsuario).not.toHaveBeenCalled();
    expect(desativarUsuario).not.toHaveBeenCalled();
  });

  it('usuário excluído perde o acesso na hora, mesmo com o token válido', async () => {
    const excluido = `sessao=${gerarToken({ id: 77, papel: 'gestor' })}`;

    const resposta = await request(criarApp()).get(ROTA).set('Cookie', excluido);

    expect(resposta.status).toBe(401);
    expect(resposta.body.error.code).toBe('SESSAO_INVALIDA');
  });

  it('operador rebaixado do papel de gestor sai da gestão sem precisar de novo login', async () => {
    const tokenDeGestor = `sessao=${gerarToken({ id: 2, papel: 'gestor' })}`;

    expect((await request(criarApp()).get(ROTA).set('Cookie', tokenDeGestor)).status).toBe(403);
  });
});

describe('GET /api/admin/usuarios', () => {
  it('o gestor não vê a conta da TI; o admin vê todos', async () => {
    vi.mocked(listarUsuariosAtivos).mockResolvedValue([{ ...OLIVIA, criado_em: new Date('2026-11-01T12:00:00Z') }]);

    const resposta = await request(criarApp()).get(ROTA).set('Cookie', GESTOR);
    expect(listarUsuariosAtivos).toHaveBeenCalledWith('admin');
    expect(resposta.body.usuarios).toEqual([{ id: 2, nome: 'Olívia', email: 'olivia@exemplo.com', papel: 'operador', criadoEm: '2026-11-01T12:00:00.000Z' }]);

    await request(criarApp()).get(ROTA).set('Cookie', ADMIN);
    expect(listarUsuariosAtivos).toHaveBeenLastCalledWith(undefined);
  });
});

describe('POST /api/admin/usuarios', () => {
  it('gestor cria operador: senha com hash, e-mail em minúsculas, senha fora da resposta', async () => {
    const resposta = await request(criarApp()).post(ROTA).set('Cookie', GESTOR).send(NOVO);

    expect(resposta.status).toBe(201);
    const gravado = vi.mocked(inserirUsuario).mock.calls[0][0];
    expect(gravado).toMatchObject({ nome: 'Carla', email: 'carla@exemplo.com', papel: 'operador' });
    expect(gravado.senha_hash).not.toBe(SENHA);
    expect(await bcrypt.compare(SENHA, gravado.senha_hash)).toBe(true);
    expect(resposta.body.usuario).toEqual({ id: 9, nome: 'Carla', email: 'carla@exemplo.com', papel: 'operador' });
    expect(JSON.stringify(resposta.body)).not.toContain('senha');
  });

  it('gestor não cria gestor → 403; o admin cria', async () => {
    const pedido = { ...NOVO, papel: 'gestor' };

    expect((await request(criarApp()).post(ROTA).set('Cookie', GESTOR).send(pedido)).status).toBe(403);
    expect(inserirUsuario).not.toHaveBeenCalled();
    expect((await request(criarApp()).post(ROTA).set('Cookie', ADMIN).send(pedido)).status).toBe(201);
  });

  it('e-mail já usado, mesmo de um excluído → 409', async () => {
    vi.mocked(existeUsuarioComEmail).mockResolvedValue(true);

    const resposta = await request(criarApp()).post(ROTA).set('Cookie', GESTOR).send(NOVO);

    expect(resposta.status).toBe(409);
    expect(resposta.body.error.code).toBe('EMAIL_EM_USO');
  });

  it.each([
    ['papel admin', { ...NOVO, papel: 'admin' }, 'papel'],
    ['senha curta', { ...NOVO, senha: 'curta' }, 'senha'],
    ['e-mail inválido', { ...NOVO, email: 'carla@' }, 'email'],
    ['campo extra', { ...NOVO, ativo: true }, 'ativo'],
  ])('%s → 400, sem gravar', async (_caso, corpo, campo) => {
    const resposta = await request(criarApp()).post(ROTA).set('Cookie', ADMIN).send(corpo);

    expect(resposta.status).toBe(400);
    expect(Object.keys(resposta.body.error.fields)).toContain(campo);
    expect(inserirUsuario).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/admin/usuarios/:id', () => {
  it('gestor edita um operador', async () => {
    const resposta = await request(criarApp()).patch(`${ROTA}/4`).set('Cookie', GESTOR).send({ nome: 'Bruno Lima' });

    expect(resposta.status).toBe(200);
    expect(resposta.body.usuario.nome).toBe('Bruno Lima');
  });

  it('gestor não altera o admin → 403', async () => {
    expect((await request(criarApp()).patch(`${ROTA}/1`).set('Cookie', GESTOR).send({ nome: 'Outro' })).status).toBe(403);
    expect(atualizarUsuario).not.toHaveBeenCalled();
  });

  it('gestor não promove a gestor → 403; o admin promove', async () => {
    expect((await request(criarApp()).patch(`${ROTA}/4`).set('Cookie', GESTOR).send({ papel: 'gestor' })).status).toBe(403);
    expect((await request(criarApp()).patch(`${ROTA}/4`).set('Cookie', ADMIN).send({ papel: 'gestor' })).status).toBe(200);
  });

  it('e-mail de outro usuário → 409; inexistente → 404; nada para mudar → 400', async () => {
    vi.mocked(existeUsuarioComEmail).mockResolvedValue(true);

    expect((await request(criarApp()).patch(`${ROTA}/4`).set('Cookie', GESTOR).send({ email: 'gil@exemplo.com' })).status).toBe(409);
    expect((await request(criarApp()).patch(`${ROTA}/99`).set('Cookie', GESTOR).send({ nome: 'Outro' })).status).toBe(404);
    expect((await request(criarApp()).patch(`${ROTA}/4`).set('Cookie', GESTOR).send({})).status).toBe(400);
  });
});

describe('POST /api/admin/usuarios/:id/senha', () => {
  it('gestor redefine a senha de um operador, sem devolver nada dela', async () => {
    const resposta = await request(criarApp()).post(`${ROTA}/4/senha`).set('Cookie', GESTOR).send({ senha: SENHA });

    expect(resposta.status).toBe(204);
    expect(resposta.text).toBe('');
    const [id, hash] = vi.mocked(atualizarSenha).mock.calls[0];
    expect(id).toBe(4);
    expect(await bcrypt.compare(SENHA, hash)).toBe(true);
  });

  it('senha do admin não muda por aqui → 403; senha curta → 400', async () => {
    expect((await request(criarApp()).post(`${ROTA}/1/senha`).set('Cookie', GESTOR).send({ senha: SENHA })).status).toBe(403);
    expect((await request(criarApp()).post(`${ROTA}/4/senha`).set('Cookie', GESTOR).send({ senha: 'curta' })).status).toBe(400);
    expect(atualizarSenha).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/admin/usuarios/:id', () => {
  it('gestor exclui um operador: desativa e mantém a linha, ligada ao histórico', async () => {
    const resposta = await request(criarApp()).delete(`${ROTA}/4`).set('Cookie', GESTOR);

    expect(resposta.status).toBe(204);
    expect(desativarUsuario).toHaveBeenCalledWith(4);
  });

  it('ninguém exclui a própria conta → 409', async () => {
    const resposta = await request(criarApp()).delete(`${ROTA}/3`).set('Cookie', GESTOR);

    expect(resposta.status).toBe(409);
    expect(resposta.body.error.code).toBe('EXCLUSAO_DA_PROPRIA_CONTA');
    expect(desativarUsuario).not.toHaveBeenCalled();
  });

  it('gestor não exclui o admin → 403; inexistente → 404', async () => {
    expect((await request(criarApp()).delete(`${ROTA}/1`).set('Cookie', GESTOR)).status).toBe(403);
    expect((await request(criarApp()).delete(`${ROTA}/99`).set('Cookie', GESTOR)).status).toBe(404);
    expect(desativarUsuario).not.toHaveBeenCalled();
  });
});
