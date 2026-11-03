import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { consultarCep, ErroDaApi, simular, type LocalDoCep, type Subgrupo, type TipoLigacao } from '../../services/api.ts';
import { CampoDeTexto, GrupoDeOpcoes } from '../formulario/Campos.tsx';

const opcoesDeImovel: { valor: Subgrupo; rotulo: string }[] = [
  { valor: 'B1', rotulo: 'Residencial' },
  { valor: 'B3', rotulo: 'Comercial' },
  { valor: 'B2', rotulo: 'Rural' },
];

const opcoesDeLigacao: { valor: TipoLigacao; rotulo: string }[] = [
  { valor: 'monofasico', rotulo: 'Monofásica' },
  { valor: 'bifasico', rotulo: 'Bifásica' },
  { valor: 'trifasico', rotulo: 'Trifásica' },
];

type Erros = Partial<Record<'cep' | 'tipoLigacao' | 'consumoMedioKwh' | 'distribuidora', string>>;

const somenteNumeros = (texto: string) => texto.replace(/\D/g, '');

// "1.200" e "450,5" viram 1200 e 450.5; texto que não é número vira NaN.
function lerConsumo(texto: string): number {
  return Number(texto.trim().replace(/\./g, '').replace(',', '.'));
}

// Consulta o CEP assim que ele tem 8 números, para mostrar a cidade e avisar cedo se a região não é atendida.
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
    // Digitou outro CEP antes da resposta: a resposta antiga é ignorada.
    return () => { atual = false; };
  }, [cep]);

  return { local, erro, buscando };
}

// Distribuidora já marcada: a única do município ou a sugerida (a de mais conjuntos). Sem sugerida, o visitante escolhe.
function distribuidoraInicial(local: LocalDoCep | null): string {
  if (!local) return '';
  if (local.distribuidoras.length === 1) return local.distribuidoras[0].cnpj;
  return local.distribuidoras.find((opcao) => opcao.sugerida)?.cnpj ?? '';
}

function validar(cep: string, local: LocalDoCep | null, distribuidora: string, tipoLigacao: string, consumo: number): Erros {
  const erros: Erros = {};
  if (cep.length !== 8) erros.cep = 'Informe o CEP com 8 números.';
  else if (local && !local.atendido) erros.cep = 'Ainda não temos a tarifa da distribuidora desta cidade. Fale com a equipe pelo WhatsApp.';
  if (local?.escolhaNecessaria && !distribuidora) erros.distribuidora = 'Escolha a distribuidora que aparece na sua conta de luz.';
  if (!tipoLigacao) erros.tipoLigacao = 'Selecione o tipo de ligação.';
  if (!Number.isFinite(consumo) || consumo < 1) erros.consumoMedioKwh = 'Informe o consumo médio em kWh (só números).';
  else if (consumo > 20_000) erros.consumoMedioKwh = 'O simulador aceita até 20.000 kWh por mês.';
  return erros;
}

function descreverLocal(local: LocalDoCep): string {
  const cidade = `${local.cidade} / ${local.uf}`;
  if (!local.atendido) return `${cidade} — ainda sem tarifa de distribuidora`;
  return local.distribuidoras.length === 1 ? `${cidade} · ${local.distribuidoras[0].sigla}` : cidade;
}

// Município com mais de uma distribuidora (ou sem vínculo na ANEEL): o visitante confirma a da conta de luz.
function EscolhaDeDistribuidora({ local, valor, aoMudar, erro }: { local: LocalDoCep; valor: string; aoMudar: (cnpj: string) => void; erro?: string }) {
  const temSugerida = local.distribuidoras.some((opcao) => opcao.sugerida);
  return (
    <div>
      <GrupoDeOpcoes nome="distribuidora" legenda="Distribuidora da sua conta de luz" valor={valor} aoMudar={aoMudar} erro={erro}
        opcoes={local.distribuidoras.map((opcao) => ({ valor: opcao.cnpj, rotulo: opcao.sugerida ? `${opcao.sigla} (mais comum aqui)` : opcao.sigla }))} />
      <p className="mt-2 text-sm text-muted-foreground">
        {temSugerida
          ? `${local.cidade} é atendida por mais de uma distribuidora. Deixamos marcada a mais comum; confira na sua conta.`
          : `Não encontramos na ANEEL a distribuidora de ${local.cidade}: escolha a da sua conta entre as de ${local.uf}.`}
      </p>
    </div>
  );
}

export function FormularioSimulacao() {
  const navegar = useNavigate();
  const [cep, setCep] = useState('');
  const [subgrupo, setSubgrupo] = useState<Subgrupo>('B1');
  const [tipoLigacao, setTipoLigacao] = useState<TipoLigacao | ''>('');
  const [consumo, setConsumo] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const consultaDoCep = useConsultaDeCep(somenteNumeros(cep));
  const [distribuidora, setDistribuidora] = useState('');
  useEffect(() => setDistribuidora(distribuidoraInicial(consultaDoCep.local)), [consultaDoCep.local]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const consumoMedioKwh = lerConsumo(consumo);
    const encontrados = validar(somenteNumeros(cep), consultaDoCep.local, distribuidora, tipoLigacao, consumoMedioKwh);
    setErros(encontrados);
    setErroGeral(null);
    if (Object.keys(encontrados).length > 0 || !tipoLigacao) return;
    setEnviando(true);
    try {
      const simulacao = await simular({ cep: somenteNumeros(cep), tipoLigacao, subgrupo, consumoMedioKwh, distribuidora: distribuidora || undefined });
      // O resultado vai no estado do histórico: sobrevive ao recarregar a página e ao botão voltar.
      navegar('/simulador/resultado', { state: { simulacao } });
    } catch (falha) {
      const erro = falha instanceof ErroDaApi ? falha : new ErroDaApi(0, 'ERRO_INTERNO', 'Algo deu errado. Tente de novo.');
      setErros(erro.campos as Erros);
      if (Object.keys(erro.campos).length === 0) setErroGeral(erro.message);
      setEnviando(false);
    }
  }

  const { local } = consultaDoCep;
  const ajudaDoCep = consultaDoCep.buscando ? 'Buscando a cidade…' : local ? descreverLocal(local) : undefined;

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
      <CampoDeTexto id="cep" rotulo="CEP do imóvel" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9}
        value={cep} onChange={(evento) => setCep(evento.target.value)} erro={erros.cep ?? consultaDoCep.erro}
        ajuda={<span role="status">{ajudaDoCep}</span>} />
      {local?.escolhaNecessaria && (
        <EscolhaDeDistribuidora local={local} valor={distribuidora} aoMudar={setDistribuidora} erro={erros.distribuidora} />
      )}
      <GrupoDeOpcoes nome="subgrupo" legenda="Tipo de imóvel" opcoes={opcoesDeImovel} valor={subgrupo} aoMudar={setSubgrupo} />
      <GrupoDeOpcoes nome="tipoLigacao" legenda="Tipo de ligação (está na conta de energia)" opcoes={opcoesDeLigacao}
        valor={tipoLigacao} aoMudar={setTipoLigacao} erro={erros.tipoLigacao} />
      <CampoDeTexto id="consumoMedioKwh" rotulo="Consumo médio por mês (kWh)" inputMode="decimal" placeholder="Ex.: 400"
        value={consumo} onChange={(evento) => setConsumo(evento.target.value)} erro={erros.consumoMedioKwh}
        ajuda="Some o consumo dos últimos 12 meses da conta e divida por 12. Se não tiver o histórico, use o da última conta." />
      {erroGeral && (
        <p role="alert" className="rounded-sm border border-red-700/30 bg-red-50 px-3 py-2 text-sm text-red-800">{erroGeral}</p>
      )}
      <button type="submit" disabled={enviando} className="site-button self-start disabled:opacity-70">
        {enviando ? 'Calculando…' : 'Simular minha economia'} <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
