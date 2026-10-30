import { verificarConexaoBanco } from '../repositories/saudeRepository.ts';

export interface EstadoSaude {
  status: 'ok' | 'erro';
  banco: 'ok' | 'erro';
}

// A falha do banco vira só "erro": a rota é pública e não expõe detalhes internos.
export async function verificarSaude(): Promise<EstadoSaude> {
  try {
    await verificarConexaoBanco();
    return { status: 'ok', banco: 'ok' };
  } catch {
    return { status: 'erro', banco: 'erro' };
  }
}
