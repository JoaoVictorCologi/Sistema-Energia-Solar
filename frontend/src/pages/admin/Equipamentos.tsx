import { useState, type FormEvent } from 'react';
import { Aviso, Cartao, classeDaLinha, classeDoBotaoSecundario, classeDoCabecalho, EstadoDaCarga, Tabela, Titulo } from '../../components/admin/Pecas.tsx';
import { CampoDeTexto, GrupoDeOpcoes } from '../../components/formulario/Campos.tsx';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { alterarEquipamento, cadastrarEquipamento, ErroDaApi, listarEquipamentos, type Equipamento, type TipoDeEquipamento } from '../../services/api.ts';
import { formatarNumero, formatarPercentual } from '../../utils/formatar.ts';

// "1.234,56" → 1234.56. É só a leitura do campo: o backend valida (até 2 casas) e guarda como Decimal.
function lerNumero(texto: string): number {
  return Number(texto.trim().replace(/\./g, '').replace(',', '.'));
}

const NOMES_DO_TIPO: Record<TipoDeEquipamento, string> = { modulo: 'Módulo', inversor: 'Inversor' };

export function Equipamentos() {
  useTituloDaPagina('Equipamentos — Solar Gestão');
  const carga = useCarregar(() => listarEquipamentos(), 'equipamentos');

  return (
    <>
      <Titulo sobre="Catálogo com preço, usado nas propostas">Equipamentos</Titulo>
      <div className="flex flex-col gap-8">
        <NovoEquipamento aoCadastrar={carga.recarregar} />
        <EstadoDaCarga carregando={carga.carregando && !carga.dados} erro={carga.erro} aoTentarDeNovo={carga.recarregar} />
        {carga.dados && (carga.dados.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum equipamento cadastrado.</p> : (
          <Tabela legenda="Equipamentos do catálogo">
            <thead className={classeDoCabecalho}>
              <tr><th scope="col">Tipo</th><th scope="col">Fabricante e modelo</th><th scope="col">Potência</th><th scope="col">Preço</th><th scope="col">Situação</th></tr>
            </thead>
            <tbody>{carga.dados.map((equipamento) => <LinhaDoEquipamento key={equipamento.id} inicial={equipamento} />)}</tbody>
          </Tabela>
        ))}
        <p className="text-sm text-muted-foreground">Preço novo vale só para as próximas propostas: as já emitidas guardam o preço do dia.</p>
      </div>
    </>
  );
}

function LinhaDoEquipamento({ inicial }: { inicial: Equipamento }) {
  const [equipamento, setEquipamento] = useState(inicial);
  const [preco, setPreco] = useState(formatarNumero(inicial.preco, 2));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(mudanca: { preco?: number; ativo?: boolean }) {
    setSalvando(true);
    setErro(null);
    try {
      const salvo = await alterarEquipamento(equipamento.id, mudanca);
      setEquipamento(salvo);
      setPreco(formatarNumero(salvo.preco, 2));
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? Object.values(falha.campos)[0] ?? falha.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const potencia = equipamento.tipo === 'modulo'
    ? `${formatarNumero(equipamento.potenciaW)} W${equipamento.degradacaoAnual === null ? '' : ` · perde ${formatarPercentual(equipamento.degradacaoAnual)}/ano`}`
    : `${formatarNumero(equipamento.potenciaW / 1000, 1)} kW`;
  const precoMudou = lerNumero(preco) !== equipamento.preco;
  return (
    <tr className={classeDaLinha + (equipamento.ativo ? '' : ' text-muted-foreground')}>
      <td>{NOMES_DO_TIPO[equipamento.tipo]}</td>
      <td>{equipamento.fabricante} {equipamento.modelo}</td>
      <td className="whitespace-nowrap">{potencia}</td>
      <td>
        <form onSubmit={(evento) => { evento.preventDefault(); void salvar({ preco: lerNumero(preco) }); }} className="flex items-center gap-2">
          <label htmlFor={`preco-${equipamento.id}`} className="sr-only">Preço de {equipamento.modelo} (R$)</label>
          <input id={`preco-${equipamento.id}`} inputMode="decimal" value={preco} onChange={(evento) => setPreco(evento.target.value)}
            className="min-h-11 w-32 rounded-sm border border-border px-2 text-right tabular-nums" />
          {precoMudou && <button type="submit" disabled={salvando} className="text-sm font-semibold text-brand-blue underline underline-offset-4">Salvar</button>}
        </form>
        {erro && <p className="mt-1 text-xs text-red-800">{erro}</p>}
      </td>
      <td>
        <button type="button" onClick={() => salvar({ ativo: !equipamento.ativo })} disabled={salvando} className="text-sm font-semibold underline underline-offset-4">
          {equipamento.ativo ? 'Ativo · desativar' : 'Inativo · ativar'}
        </button>
      </td>
    </tr>
  );
}

const vazio = { fabricante: '', modelo: '', potencia: '', degradacao: '', preco: '' };

function NovoEquipamento({ aoCadastrar }: { aoCadastrar: () => void }) {
  const [tipo, setTipo] = useState<TipoDeEquipamento>('modulo');
  const [campos, setCampos] = useState(vazio);
  const [erro, setErro] = useState<ErroDaApi | null>(null);
  const [salvando, setSalvando] = useState(false);
  const alterar = (campo: keyof typeof vazio, valor: string) => setCampos((atual) => ({ ...atual, [campo]: valor }));

  async function cadastrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    // O inversor é informado em kW na tela e vai em W para a API, como o módulo.
    const potenciaW = tipo === 'modulo' ? lerNumero(campos.potencia) : lerNumero(campos.potencia) * 1000;
    try {
      await cadastrarEquipamento({
        tipo, fabricante: campos.fabricante.trim(), modelo: campos.modelo.trim(), potenciaW, preco: lerNumero(campos.preco),
        ...(tipo === 'modulo' && campos.degradacao.trim() ? { degradacaoAnual: lerNumero(campos.degradacao) / 100 } : {}),
      });
      setCampos(vazio);
      aoCadastrar();
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha : new ErroDaApi(0, 'ERRO_INTERNO', 'Não foi possível cadastrar.'));
    } finally {
      setSalvando(false);
    }
  }

  const campo = erro?.campos ?? {};
  return (
    <Cartao>
      <h2 className="mb-5 font-heading text-lg font-medium text-brand-blue">Cadastrar equipamento</h2>
      <form onSubmit={cadastrar} noValidate className="flex flex-col gap-5">
        <GrupoDeOpcoes nome="tipo" legenda="Tipo" valor={tipo} aoMudar={setTipo}
          opcoes={[{ valor: 'modulo', rotulo: 'Módulo' }, { valor: 'inversor', rotulo: 'Inversor' }]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoDeTexto id="fabricante" rotulo="Fabricante" value={campos.fabricante} onChange={(e) => alterar('fabricante', e.target.value)} erro={campo.fabricante} />
          <CampoDeTexto id="modelo" rotulo="Modelo" value={campos.modelo} onChange={(e) => alterar('modelo', e.target.value)} erro={campo.modelo} />
          <CampoDeTexto id="potencia" rotulo={tipo === 'modulo' ? 'Potência (W)' : 'Potência (kW)'} inputMode="decimal"
            value={campos.potencia} onChange={(e) => alterar('potencia', e.target.value)} erro={campo.potenciaW}
            ajuda={tipo === 'modulo' ? 'Entre 100 e 800 W.' : undefined} />
          <CampoDeTexto id="preco" rotulo="Preço (R$)" inputMode="decimal" value={campos.preco} onChange={(e) => alterar('preco', e.target.value)} erro={campo.preco} />
          {tipo === 'modulo' && (
            <CampoDeTexto id="degradacao" rotulo="Degradação anual (%) — opcional" inputMode="decimal" placeholder="0,5"
              value={campos.degradacao} onChange={(e) => alterar('degradacao', e.target.value)} erro={campo.degradacaoAnual}
              ajuda="Do datasheet, entre 0,2% e 1%. Sem ela, vale 0,5% ao ano." />
          )}
        </div>
        {erro && Object.keys(campo).length === 0 && <Aviso>{erro.message}</Aviso>}
        <button type="submit" disabled={salvando} className={classeDoBotaoSecundario + ' self-start'}>{salvando ? 'Salvando…' : 'Cadastrar'}</button>
      </form>
    </Cartao>
  );
}

