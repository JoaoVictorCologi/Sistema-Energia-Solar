import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { ErroDaApi, gerarProposta, listarEquipamentos, type Equipamento } from '../../services/api.ts';
import { formatarNumero, formatarReais } from '../../utils/formatar.ts';
import { classeDoCampo, MensagemDeErro } from '../formulario/Campos.tsx';
import { Aviso, classeDoBotaoSecundario, EstadoDaCarga } from './Pecas.tsx';

function descreverEquipamento(equipamento: Equipamento): string {
  const potencia = equipamento.tipo === 'modulo' ? `${formatarNumero(equipamento.potenciaW)} W` : `${formatarNumero(equipamento.potenciaW / 1000, 1)} kW`;
  return `${equipamento.fabricante} ${equipamento.modelo} — ${potencia} — ${formatarReais(equipamento.preco)}`;
}

function Escolha({ id, rotulo, opcoes, valor, aoMudar, erro }: {
  id: string; rotulo: string; opcoes: Equipamento[]; valor: string; aoMudar: (valor: string) => void; erro?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-brand-ink">{rotulo}</label>
      <select id={id} value={valor} onChange={(evento) => aoMudar(evento.target.value)} className={classeDoCampo}
        aria-invalid={Boolean(erro)} aria-describedby={erro ? `erro-${id}` : undefined}>
        <option value="">Escolha…</option>
        {opcoes.map((opcao) => <option key={opcao.id} value={opcao.id}>{descreverEquipamento(opcao)}</option>)}
      </select>
      <MensagemDeErro id={`erro-${id}`} texto={erro} />
    </div>
  );
}

// Só a escolha dos equipamentos vai para a API: quantidade, preço e premissas são calculados no backend.
export function GerarProposta({ codigoDaSimulacao }: { codigoDaSimulacao: string }) {
  const navegar = useNavigate();
  const catalogo = useCarregar(() => listarEquipamentos(), 'catalogo');
  const [moduloId, setModuloId] = useState('');
  const [inversorId, setInversorId] = useState('');
  const [erro, setErro] = useState<ErroDaApi | null>(null);
  const [gerando, setGerando] = useState(false);

  const ativos = (catalogo.dados ?? []).filter((equipamento) => equipamento.ativo);
  const modulos = ativos.filter((equipamento) => equipamento.tipo === 'modulo');
  const inversores = ativos.filter((equipamento) => equipamento.tipo === 'inversor');

  async function gerar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!moduloId || !inversorId) {
      setErro(new ErroDaApi(400, 'ENTRADA_INVALIDA', '', { ...(moduloId ? {} : { moduloId: 'Escolha o módulo.' }), ...(inversorId ? {} : { inversorId: 'Escolha o inversor.' }) }));
      return;
    }
    setGerando(true);
    setErro(null);
    try {
      const proposta = await gerarProposta({ simulacao: codigoDaSimulacao, moduloId: Number(moduloId), inversorId: Number(inversorId) });
      navegar(`/admin/propostas/${proposta.id}`);
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha : new ErroDaApi(0, 'ERRO_INTERNO', 'Não foi possível gerar a proposta.'));
      setGerando(false);
    }
  }

  if (catalogo.carregando || catalogo.erro) return <EstadoDaCarga carregando={catalogo.carregando} erro={catalogo.erro} aoTentarDeNovo={catalogo.recarregar} />;
  if (modulos.length === 0 || inversores.length === 0) {
    return <p className="text-sm">Cadastre ao menos um módulo e um inversor ativos em <Link to="/admin/equipamentos" className="font-semibold underline underline-offset-4">Equipamentos</Link>.</p>;
  }
  return (
    <form onSubmit={gerar} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Escolha id={`modulo-${codigoDaSimulacao}`} rotulo="Módulo" opcoes={modulos} valor={moduloId} aoMudar={setModuloId} erro={erro?.campos.moduloId} />
        <Escolha id={`inversor-${codigoDaSimulacao}`} rotulo="Inversor" opcoes={inversores} valor={inversorId} aoMudar={setInversorId} erro={erro?.campos.inversorId} />
      </div>
      {erro?.message && Object.keys(erro.campos).length === 0 && <Aviso>{erro.message}</Aviso>}
      <p className="text-sm text-muted-foreground">O preço sai do catálogo e da instalação por kWp, calculado no servidor. A proposta vale por 10 dias.</p>
      <button type="submit" disabled={gerando} className={classeDoBotaoSecundario + ' self-start'}>{gerando ? 'Gerando…' : 'Gerar proposta'}</button>
    </form>
  );
}
