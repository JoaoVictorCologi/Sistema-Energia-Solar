import { useCallback, useEffect, useState } from 'react';
import { ErroDaApi } from '../services/api.ts';

export interface Carga<Dados> {
  dados: Dados | null;
  erro: string | null;
  carregando: boolean;
  recarregar: () => void;
}

// Busca os dados de uma tela e repete a busca quando `chave` muda (filtro, página, id).
// Respostas que chegam depois da troca de chave são descartadas.
export function useCarregar<Dados>(buscar: () => Promise<Dados>, chave: string): Carga<Dados> {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((atual) => atual + 1), []);

  useEffect(() => {
    let atual = true;
    setCarregando(true);
    setErro(null);
    buscar()
      .then((recebidos) => { if (atual) setDados(recebidos); })
      .catch((falha) => { if (atual) setErro(falha instanceof ErroDaApi ? falha.message : 'Não foi possível carregar os dados.'); })
      .finally(() => { if (atual) setCarregando(false); });
    return () => { atual = false; };
    // `buscar` é recriada a cada renderização; é a chave que determina uma nova busca.
  }, [chave, versao]);

  return { dados, erro, carregando, recarregar };
}
