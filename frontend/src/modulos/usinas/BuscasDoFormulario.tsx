// Buscas de cliente e município do formulário da usina: o usuário busca, escolhe um resultado, e só a escolha vai para o formulário.
import { Check, Search } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { Aviso, classeDoBotaoSecundario } from '../../components/admin/Pecas.tsx';
import { CampoDeTexto, classeDoCampo, MensagemDeErro } from '../../components/formulario/Campos.tsx';
import { listarClientes, type ClienteDaLista, type ErroDaApi, type Pagina } from '../../services/api.ts';
import { buscarMunicipios } from './api.ts';
import { comoErroDaApi } from './PecasDaUsina.tsx';
import type { ClienteDaUsina, MunicipioDaUsina } from './tipos.ts';

// As 27 UFs, para o filtro opcional da busca de municípios.
const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];
// A API devolve no máximo 20 municípios, sem total: com 20, pode haver mais.
const MAXIMO_DE_MUNICIPIOS = 20;

interface EstadoDaBusca<Resposta> {
  buscando: boolean;
  resposta: Resposta | null;
  erro: ErroDaApi | null;
}

// Estado de uma busca disparada pelo usuário: não há busca automática a cada letra.
function useBusca<Resposta>() {
  const ultimaBusca = useRef(0);
  const [estado, setEstado] = useState<EstadoDaBusca<Resposta>>({ buscando: false, resposta: null, erro: null });

  async function executar(chamada: () => Promise<Resposta>) {
    ultimaBusca.current += 1;
    const estaBusca = ultimaBusca.current;
    setEstado({ buscando: true, resposta: null, erro: null });
    try {
      const resposta = await chamada();
      // Só a busca mais recente vale: uma resposta antiga que chega depois é ignorada.
      if (estaBusca === ultimaBusca.current) setEstado({ buscando: false, resposta, erro: null });
    } catch (falha) {
      if (estaBusca === ultimaBusca.current) setEstado({ buscando: false, resposta: null, erro: comoErroDaApi(falha) });
    }
  }

  return { ...estado, executar };
}

// Estes campos ficam dentro do formulário da usina: sem isto, Enter neles salvaria a usina.
function aoApertarEnter(buscar: () => void) {
  return (evento: KeyboardEvent) => {
    if (evento.key !== 'Enter') return;
    evento.preventDefault();
    buscar();
  };
}

// type="button": sem isso, o clique enviaria o formulário da usina.
function BotaoBuscar({ aoBuscar }: { aoBuscar: () => void }) {
  return (
    <div className="mt-3">
      <button type="button" onClick={aoBuscar} className={classeDoBotaoSecundario}><Search aria-hidden="true" className="size-4" /> Buscar</button>
    </div>
  );
}

// Formato comum aos resultados de cliente e de município.
interface OpcaoDaBusca {
  chave: number;
  titulo: string;
  detalhe: string;
}

// Cada resultado é um botão; aria-pressed indica a opção escolhida também para leitor de tela.
function ResultadosDaBusca({ opcoes, escolhida, aoEscolher }: { opcoes: OpcaoDaBusca[]; escolhida?: number; aoEscolher: (chave: number) => void }) {
  if (opcoes.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {opcoes.map(({ chave, titulo, detalhe }) => (
        <li key={chave}>
          <button
            type="button" aria-pressed={escolhida === chave} onClick={() => aoEscolher(chave)}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm border border-border bg-white px-3 py-2 text-left text-sm aria-pressed:border-brand-blue aria-pressed:text-brand-blue"
          >
            <span className="min-w-0 [overflow-wrap:anywhere]"><span className="font-semibold">{titulo}</span> · {detalhe}</span>
            {escolhida === chave && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold"><Check aria-hidden="true" className="size-4" /> Escolhido</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

// Região role="status": anuncia busca em andamento, nenhum resultado e aviso de refino.
function SituacaoDaBusca({ buscando, semResultado, avisoDeRefino }: { buscando: boolean; semResultado: string | null; avisoDeRefino: string | null }) {
  return (
    <div role="status" className="text-sm text-muted-foreground">
      {buscando && <p className="mt-3">Buscando…</p>}
      {semResultado && <p className="mt-3">{semResultado}</p>}
      {avisoDeRefino && <p className="mt-3">{avisoDeRefino}</p>}
    </div>
  );
}

// A busca traz só a primeira página de clientes: com mais resultados, o aviso pede para refinar.
function clientesEncontrados(resposta: (Pagina & { clientes: ClienteDaLista[] }) | null) {
  const clientes = resposta?.clientes ?? [];
  const total = resposta?.total ?? 0;
  return {
    clientes,
    avisoDeRefino: total > clientes.length ? `Mostrando ${clientes.length} de ${total} clientes. Refine a busca para encontrar os demais.` : null,
  };
}

// A usina exige cliente já cadastrado: aqui só se escolhe, nunca se cria.
// O campo de busca mostra tanto o erro da busca quanto o de cliente recusado ao salvar.
export function EscolhaDeCliente({ escolhido, aoEscolher, erro }: { escolhido: ClienteDaUsina | null; aoEscolher: (cliente: ClienteDaUsina) => void; erro?: string }) {
  const [texto, setTexto] = useState('');
  const busca = useBusca<Pagina & { clientes: ClienteDaLista[] }>();
  const buscar = () => void busca.executar(() => listarClientes({ busca: texto.trim(), pagina: 1 }));
  const { clientes, avisoDeRefino } = clientesEncontrados(busca.resposta);
  const erroDaBusca = busca.erro?.campos.busca;
  const opcoes = clientes.map(({ id, nome, email }) => ({ chave: id, titulo: nome, detalhe: email }));

  function escolher(chave: number) {
    const cliente = clientes.find(({ id }) => id === chave);
    if (cliente) aoEscolher({ id: cliente.id, nome: cliente.nome });
  }

  return (
    <fieldset>
      <legend className="font-heading text-lg font-medium text-brand-blue">Cliente</legend>
      <div className="mt-3">
        <CampoDeTexto
          id="busca-cliente" rotulo="Buscar cliente por nome ou e-mail" type="search" value={texto} onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={aoApertarEnter(buscar)} erro={erroDaBusca ?? erro} ajuda="A usina exige um cliente já cadastrado."
        />
      </div>
      <BotaoBuscar aoBuscar={buscar} />
      {busca.erro && !erroDaBusca && <div className="mt-3"><Aviso>{busca.erro.message}</Aviso></div>}
      <SituacaoDaBusca buscando={busca.buscando} semResultado={busca.resposta && clientes.length === 0 ? 'Nenhum cliente encontrado.' : null} avisoDeRefino={avisoDeRefino} />
      <ResultadosDaBusca opcoes={opcoes} escolhida={escolhido?.id} aoEscolher={escolher} />
      <p role="status" className="mt-3 text-sm [overflow-wrap:anywhere]">{escolhido ? <>Cliente escolhido: <strong>{escolhido.nome}</strong></> : 'Nenhum cliente escolhido.'}</p>
    </fieldset>
  );
}

// Filtro opcional: vazio, a consulta sai sem uf. Enter aqui também busca, sem salvar a usina.
function FiltroDeUf({ valor, aoMudar, aoEnter, erro }: { valor: string; aoMudar: (uf: string) => void; aoEnter: (evento: KeyboardEvent) => void; erro?: string }) {
  return (
    <div>
      <label htmlFor="uf-municipio" className="block text-sm font-semibold text-brand-ink">UF (opcional)</label>
      <select
        id="uf-municipio" value={valor} onChange={(evento) => aoMudar(evento.target.value)} onKeyDown={aoEnter}
        aria-invalid={Boolean(erro)} aria-describedby={erro ? 'erro-uf-municipio' : undefined} className={classeDoCampo}
      >
        <option value="">Todas</option>
        {UFS.map((sigla) => <option key={sigla} value={sigla}>{sigla}</option>)}
      </select>
      <MensagemDeErro id="erro-uf-municipio" texto={erro} />
    </div>
  );
}

// A busca só lê e não grava município. Como a resposta não traz total, o aviso de refino aparece ao atingir o máximo.
export function EscolhaDeMunicipio({ escolhido, aoEscolher, erro }: { escolhido: MunicipioDaUsina | null; aoEscolher: (municipio: MunicipioDaUsina) => void; erro?: string }) {
  const [texto, setTexto] = useState('');
  const [uf, setUf] = useState('');
  const busca = useBusca<MunicipioDaUsina[]>();
  const buscar = () => void busca.executar(() => buscarMunicipios({ busca: texto.trim(), uf }));
  const municipios = busca.resposta ?? [];
  const erroDaBusca = busca.erro?.campos.busca;
  const erroDaUf = busca.erro?.campos.uf;
  const opcoes = municipios.map(({ codigoIbge, nome, uf: sigla }) => ({ chave: codigoIbge, titulo: nome, detalhe: sigla }));

  function escolher(chave: number) {
    const municipio = municipios.find(({ codigoIbge }) => codigoIbge === chave);
    if (municipio) aoEscolher(municipio);
  }

  return (
    <fieldset>
      <legend className="font-heading text-lg font-medium text-brand-blue">Município</legend>
      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_10rem]">
        <CampoDeTexto
          id="busca-municipio" rotulo="Buscar município" type="search" value={texto} onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={aoApertarEnter(buscar)} erro={erroDaBusca ?? erro} ajuda="A busca distingue acentos: “sao paulo” não encontra “São Paulo”."
        />
        <FiltroDeUf valor={uf} aoMudar={setUf} aoEnter={aoApertarEnter(buscar)} erro={erroDaUf} />
      </div>
      <BotaoBuscar aoBuscar={buscar} />
      {busca.erro && !erroDaBusca && !erroDaUf && <div className="mt-3"><Aviso>{busca.erro.message}</Aviso></div>}
      <SituacaoDaBusca
        buscando={busca.buscando} semResultado={busca.resposta && municipios.length === 0 ? 'Nenhum município encontrado.' : null}
        avisoDeRefino={municipios.length >= MAXIMO_DE_MUNICIPIOS ? `Mostrando os primeiros ${MAXIMO_DE_MUNICIPIOS} municípios. Refine a busca para encontrar os demais.` : null}
      />
      <ResultadosDaBusca opcoes={opcoes} escolhida={escolhido?.codigoIbge} aoEscolher={escolher} />
      <p role="status" className="mt-3 text-sm [overflow-wrap:anywhere]">{escolhido ? <>Município escolhido: <strong>{escolhido.nome}/{escolhido.uf}</strong></> : 'Nenhum município escolhido.'}</p>
    </fieldset>
  );
}
