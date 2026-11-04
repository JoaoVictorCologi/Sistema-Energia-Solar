import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { consultarCep, ErroDaApi, simular, type LocalDoCep } from '../../services/api.ts';
import { conferirDados, DADOS_VAZIOS, montarPedido, somenteNumeros, type DadosDaSimulacao, type ErrosDaSimulacao, type EstadoDoResultado } from './dadosDaSimulacao.ts';
import { SecaoDaConta, SecaoDoImovel, SecaoDoTelhado, SecaoDoUso, SecaoFinal } from './SecoesDoFormulario.tsx';

// Consulta o CEP ao completar 8 números, para mostrar a cidade e avisar cedo se a região não é atendida.
function useConsultaDeCep(cep: string) {
  const [local, setLocal] = useState<LocalDoCep | null>(null);
  const [erro, setErro] = useState<string | undefined>();
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    setLocal(null);
    setErro(undefined);
    if (cep.length !== 8) return;
    let atual = true;
    setBuscando(true);
    consultarCep(cep)
      .then((encontrado) => { if (atual) setLocal(encontrado); })
      .catch((falha) => { if (atual) setErro(falha instanceof ErroDaApi ? falha.message : 'Não foi possível consultar o CEP.'); })
      .finally(() => { if (atual) setBuscando(false); });
    // Com outro CEP digitado antes da resposta, a resposta antiga é descartada.
    return () => { atual = false; };
  }, [cep]);

  return { local, erro, buscando };
}

// Mantém a distribuidora escolhida se ela está entre as opções do CEP; caso contrário, usa a única do município ou a sugerida.
function distribuidoraDoLocal(escolhida: string, local: LocalDoCep): string {
  if (local.distribuidoras.some((opcao) => opcao.cnpj === escolhida)) return escolhida;
  if (local.distribuidoras.length === 1) return local.distribuidoras[0].cnpj;
  return local.distribuidoras.find((opcao) => opcao.sugerida)?.cnpj ?? '';
}

// Em um formulário longo, o envio com pendências precisa levar o usuário ao primeiro campo com problema.
function levarAoPrimeiroErro(formulario: HTMLFormElement | null) {
  const campo = formulario?.querySelector<HTMLElement>('[aria-invalid="true"], fieldset[aria-describedby^="erro-"]');
  if (!campo) return;
  campo.scrollIntoView({ block: 'center' });
  (campo.matches('fieldset') ? campo.querySelector<HTMLElement>('input') : campo)?.focus({ preventScroll: true });
}

// Erros dos 12 meses chegam por mês ("consumoMensalKwh.3"); a tela mostra um único aviso, abaixo da grade.
function errosDaApi(campos: Record<string, string>): ErrosDaSimulacao {
  return Object.fromEntries(Object.entries(campos).map(([campo, mensagem]) => [campo.startsWith('consumoMensalKwh') ? 'consumoMensalKwh' : campo, mensagem]));
}

// Formulário único, antes do primeiro resultado: quem mora na casa fornece, a baixo custo, os dados que faltam ao cálculo.
export function FormularioSimulacao() {
  const navegar = useNavigate();
  const local = useLocation();
  const estado = local.state as EstadoDoResultado | null;
  const [dados, setDados] = useState<DadosDaSimulacao>(estado?.dados ?? DADOS_VAZIOS);
  // Depois da primeira tentativa, a conferência acompanha a digitação, e cada aviso some quando a resposta é dada.
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [errosDoServidor, setErrosDoServidor] = useState<ErrosDaSimulacao>({});
  const [erroDoServidor, setErroDoServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const consulta = useConsultaDeCep(somenteNumeros(dados.cep));

  const errosDaTela = tentouEnviar ? conferirDados(dados, consulta.local, consulta.erro) : {};
  const faltaResposta = Object.keys(errosDaTela).length > 0;

  function mudar(mudanca: Partial<DadosDaSimulacao>) {
    setDados((atual) => ({ ...atual, ...mudanca }));
    setErrosDoServidor({});
    setErroDoServidor(null);
  }

  useEffect(() => {
    if (!consulta.local) return;
    const encontrado = consulta.local;
    setDados((atual) => ({ ...atual, distribuidora: distribuidoraDoLocal(atual.distribuidora, encontrado) }));
  }, [consulta.local]);

  // "Simulador" no menu, com a tela já aberta, mantém a mesma rota: o formulário é reiniciado aqui.
  useEffect(() => {
    if (estado) return;
    setDados(DADOS_VAZIOS);
    setTentouEnviar(false);
    setErrosDoServidor({});
    setErroDoServidor(null);
  }, [local.key]);

  async function calcular() {
    setEnviando(true);
    try {
      const simulacao = await simular(montarPedido(dados));
      const novoEstado = { simulacao, dados } satisfies EstadoDoResultado;
      // Grava as respostas nesta entrada do histórico, para o botão voltar do navegador não as perder.
      await navegar('/simulador', { replace: true, state: novoEstado });
      await navegar('/simulador/resultado', { state: novoEstado });
    } catch (falha) {
      const erro = falha instanceof ErroDaApi ? falha : new ErroDaApi(0, 'ERRO_INTERNO', 'Algo deu errado. Tente de novo.');
      const temCampos = Object.keys(erro.campos).length > 0;
      setErrosDoServidor(errosDaApi(erro.campos));
      setErroDoServidor(temCampos ? 'Confira os campos marcados.' : erro.message);
      setEnviando(false);
      requestAnimationFrame(() => levarAoPrimeiroErro(formulario.current));
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setTentouEnviar(true);
    if (Object.keys(conferirDados(dados, consulta.local, consulta.erro)).length > 0) {
      requestAnimationFrame(() => levarAoPrimeiroErro(formulario.current));
      return;
    }
    void calcular();
  }

  const secao = { dados, mudar, erros: { ...errosDoServidor, ...errosDaTela } };
  const aviso = faltaResposta ? 'Faltam algumas respostas: confira os campos marcados.' : erroDoServidor;
  return (
    <form ref={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-6">
      <SecaoDoImovel {...secao} consulta={consulta} />
      <SecaoDaConta {...secao} />
      <SecaoDoUso {...secao} />
      <SecaoDoTelhado {...secao} />
      <SecaoFinal {...secao} />
      {aviso && <p role="alert" className="rounded-sm border border-red-700/30 bg-red-50 px-3 py-2 text-sm text-red-800">{aviso}</p>}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <button type="submit" disabled={enviando} className="site-button disabled:opacity-70">
          {enviando ? 'Calculando…' : 'Ver minha economia'} <span aria-hidden="true">↗</span>
        </button>
        {estado?.simulacao && <Link to="/simulador/resultado" state={estado} className="site-link">Voltar ao resultado sem mudar nada</Link>}
      </div>
    </form>
  );
}
