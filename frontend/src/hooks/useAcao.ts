import { useCallback, useState } from 'react';
import { ErroDaApi } from '../services/api.ts';

// Estado de uma ação de botão ou formulário da área restrita: indica o andamento e guarda o erro da API.
// `executar` devolve undefined em caso de falha; a tela exibe `erro` no campo correspondente, quando a API o indica.
export function useAcao() {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<ErroDaApi | null>(null);

  const executar = useCallback(async <Resultado,>(acao: () => Promise<Resultado>): Promise<Resultado | undefined> => {
    setOcupado(true);
    setErro(null);
    try {
      return await acao();
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha : new ErroDaApi(0, 'ERRO_INTERNO', 'Algo deu errado. Tente de novo.'));
      return undefined;
    } finally {
      setOcupado(false);
    }
  }, []);

  return { executar, ocupado, erro, setErro };
}

// Mensagem para o aviso geral: existe apenas quando nenhum campo exibe o problema.
export function mensagemGeral(erro: ErroDaApi | null): string | null {
  return erro && Object.keys(erro.campos).length === 0 ? erro.message : null;
}
