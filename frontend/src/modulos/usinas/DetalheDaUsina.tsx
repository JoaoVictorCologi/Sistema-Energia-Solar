// Detalhe da usina: dados, equipamentos e desativação. Fica disponível também para usina desativada.
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Cartao, classeDoBotaoSecundario, EstadoDaCarga, Titulo } from '../../components/admin/Pecas.tsx';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { formatarData, formatarNumero } from '../../utils/formatar.ts';
import { buscarUsina } from './api.ts';
import { ConfirmarDesativacao } from './ConfirmarDesativacao.tsx';
import { EquipamentosDaUsina } from './EquipamentosDaUsina.tsx';
import { Confirmacao, dadosProntos, NOMES_DO_REGIME, SeloDaSituacao } from './PecasDaUsina.tsx';
import type { EquipamentoDaUsina, UsinaDetalhada } from './tipos.ts';

// O key recria a carga ao trocar de usina: nada da usina anterior fica na tela.
export function DetalheDaUsina() {
  const id = Number(useParams().id);
  return <CargaDoDetalhe key={id} id={id} />;
}

// O state da navegação sobrevive ao recarregar: sem limpar, "salvo" reapareceria depois de um F5.
function useConfirmacaoDaNavegacao(): string | null {
  const local = useLocation();
  const navegar = useNavigate();
  const [confirmacao] = useState((local.state as { confirmacao?: string } | null)?.confirmacao ?? null);

  useEffect(() => {
    if (confirmacao) navegar(local.pathname, { replace: true, state: null });
    // Só ao abrir a tela: a limpeza acontece uma vez.
  }, []);

  return confirmacao;
}

// Carrega a usina e só mostra a confirmação trazida da tela anterior depois de os dados chegarem.
function CargaDoDetalhe({ id }: { id: number }) {
  const carga = useCarregar(() => buscarUsina(id), String(id));
  const usina = dadosProntos(carga);
  const confirmacao = useConfirmacaoDaNavegacao();
  useTituloDaPagina(`${usina?.cliente.nome ?? 'Usina'} — Solar Gestão`);

  return (
    <>
      <Link to="/admin/usinas" className="site-link mb-2">← Usinas</Link>
      <EstadoDaCarga carregando={carga.carregando} erro={carga.erro} aoTentarDeNovo={carga.recarregar} />
      <Confirmacao texto={usina ? confirmacao : null} className="mb-6" />
      {usina && <ConteudoDoDetalhe inicial={usina} />}
    </>
  );
}

// A API lista por id: o novo entra no fim, e o editado fica na própria linha.
function comEquipamento(equipamentos: EquipamentoDaUsina[], salvo: EquipamentoDaUsina): EquipamentoDaUsina[] {
  const existe = equipamentos.some(({ id }) => id === salvo.id);
  return existe ? equipamentos.map((equipamento) => (equipamento.id === salvo.id ? salvo : equipamento)) : [...equipamentos, salvo];
}

// Guarda a usina em estado: desativar e gravar equipamento atualizam a tela com a resposta da API, sem recarregar.
function ConteudoDoDetalhe({ inicial }: { inicial: UsinaDetalhada }) {
  const [usina, setUsina] = useState(inicial);
  const [acabouDeDesativar, setAcabouDeDesativar] = useState(false);
  const avisoDeDesativada = useRef<HTMLParagraphElement>(null);

  // O botão de origem some com a desativação: o foco vai para o aviso que aparece no lugar.
  useEffect(() => {
    if (acabouDeDesativar) avisoDeDesativada.current?.focus();
  }, [acabouDeDesativar]);

  function registrarDesativacao(desativada: UsinaDetalhada) {
    setUsina(desativada);
    setAcabouDeDesativar(true);
  }

  // Usina desativada não tem o que desativar, mas Editar continua disponível.
  const acoes = (
    <div className="flex flex-wrap gap-3">
      <Link to={`/admin/usinas/${usina.id}/editar`} className={classeDoBotaoSecundario}>Editar</Link>
      {usina.status === 'ativa' && <ConfirmarDesativacao idDaUsina={usina.id} aoDesativar={registrarDesativacao} />}
    </div>
  );

  return (
    <>
      <Titulo sobre="Usina" acoes={acoes}><span className="[overflow-wrap:anywhere]">{usina.cliente.nome}</span></Titulo>
      <div className="flex flex-col gap-8">
        {usina.status === 'desativada' && (
          <p ref={avisoDeDesativada} tabIndex={-1} role="note" className="rounded-md border border-border bg-white p-4 text-sm">
            Esta usina está desativada e não aparece nas listagens de ativas. Os dados e os equipamentos continuam aqui, e a edição segue disponível.
          </p>
        )}
        <DadosDaUsina usina={usina} />
        <EquipamentosDaUsina
          idDaUsina={usina.id} equipamentos={usina.equipamentos}
          aoGravar={(salvo) => setUsina((atual) => ({ ...atual, equipamentos: comEquipamento(atual.equipamentos, salvo) }))}
        />
      </div>
    </>
  );
}

// O regime vem pronto da API: a tela só escolhe o nome de exibição e formata os valores.
function DadosDaUsina({ usina }: { usina: UsinaDetalhada }) {
  return (
    <Cartao>
      <h2 className="font-heading text-lg font-medium text-brand-blue">Dados da usina</h2>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-muted-foreground">Situação</dt><dd className="mt-1"><SeloDaSituacao status={usina.status} /></dd></div>
        <div>
          <dt className="text-muted-foreground">Cliente</dt>
          <dd className="mt-1 font-medium">
            <Link to={`/admin/clientes/${usina.cliente.id}`} className="inline-flex min-h-11 min-w-11 items-center font-semibold text-brand-blue underline-offset-4 [overflow-wrap:anywhere] hover:underline">
              {usina.cliente.nome}
            </Link>
          </dd>
        </div>
        <div><dt className="text-muted-foreground">Município/UF</dt><dd className="mt-1 font-medium">{usina.municipio.nome}/{usina.municipio.uf}</dd></div>
        <div><dt className="text-muted-foreground">Potência</dt><dd className="mt-1 font-medium tabular-nums">{formatarNumero(usina.kwp, 3)} kWp</dd></div>
        <div><dt className="text-muted-foreground">Regime</dt><dd className="mt-1 font-medium">{NOMES_DO_REGIME[usina.regime]}</dd></div>
        <div><dt className="text-muted-foreground">Protocolo</dt><dd className="mt-1 font-medium">{formatarData(usina.dataProtocolo)}</dd></div>
        <div><dt className="text-muted-foreground">Conexão</dt><dd className="mt-1 font-medium">{formatarData(usina.dataConexao)}</dd></div>
        <div><dt className="text-muted-foreground">Limpeza</dt><dd className="mt-1 font-medium">A cada {usina.intervaloLimpezaMeses} meses</dd></div>
      </dl>
    </Cartao>
  );
}
