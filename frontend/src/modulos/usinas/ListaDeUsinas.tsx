// Lista das usinas ativas, com busca pelo cliente e paginação. Usina desativada não aparece aqui; o detalhe dela continua disponível.
import { Plus, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { classeDaLinha, classeDoBotaoSecundario, classeDoCabecalho, EstadoDaCarga, Paginacao, Tabela, Titulo } from '../../components/admin/Pecas.tsx';
import { classeDoCampo } from '../../components/formulario/Campos.tsx';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { formatarData, formatarNumero } from '../../utils/formatar.ts';
import { listarUsinas } from './api.ts';
import { dadosProntos, NOMES_DO_REGIME } from './PecasDaUsina.tsx';
import type { PaginaDeUsinas, UsinaDaLista } from './tipos.ts';

// Busca e página ficam na URL, como em Clientes: voltar do detalhe mantém a lista onde estava.
export function ListaDeUsinas() {
  useTituloDaPagina('Usinas — Solar Gestão');
  const [parametros, setParametros] = useSearchParams();
  const busca = parametros.get('busca') ?? '';
  // Página ausente, zero ou que não é número vira 1; o resto a API confere.
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const carga = useCarregar(() => listarUsinas({ busca, pagina }), `${busca}|${pagina}`);
  const dados = dadosProntos(carga);
  const linkDaPagina = (numero: number) => `?${new URLSearchParams({ ...(busca ? { busca } : {}), pagina: String(numero) })}`;

  return (
    <>
      <Titulo
        sobre="Acompanhamento pós-venda"
        acoes={<Link to="/admin/usinas/nova" className={classeDoBotaoSecundario}><Plus aria-hidden="true" className="size-4" /> Nova usina</Link>}
      >
        Usinas
      </Titulo>
      <BuscaDaLista key={busca} buscaInicial={busca} aoBuscar={(texto) => setParametros(texto ? { busca: texto } : {})} />
      <EstadoDaCarga carregando={carga.carregando} erro={carga.erro} aoTentarDeNovo={carga.recarregar} />
      {dados && <ResultadoDaLista dados={dados} busca={busca} linkDaPagina={linkDaPagina} />}
    </>
  );
}

// Busca ao confirmar, não a cada letra. O key usado pela tela recria o campo quando a busca da URL muda.
function BuscaDaLista({ buscaInicial, aoBuscar }: { buscaInicial: string; aoBuscar: (texto: string) => void }) {
  const [texto, setTexto] = useState(buscaInicial);

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    aoBuscar(texto.trim());
  }

  return (
    <form onSubmit={buscar} role="search" className="mb-6 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1 basis-64">
        <label htmlFor="busca" className="block text-sm font-semibold text-brand-ink">Buscar por nome ou e-mail do cliente</label>
        <input id="busca" type="search" value={texto} onChange={(evento) => setTexto(evento.target.value)} className={classeDoCampo} />
      </div>
      <button type="submit" className={classeDoBotaoSecundario + ' min-h-12'}><Search aria-hidden="true" className="size-4" /> Buscar</button>
    </form>
  );
}

// Distingue página além do fim, que tem link de volta, de lista realmente vazia.
function ResultadoDaLista({ dados, busca, linkDaPagina }: { dados: PaginaDeUsinas; busca: string; linkDaPagina: (numero: number) => string }) {
  if (dados.usinas.length === 0 && dados.total > 0) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        Esta página não existe.
        <Link to={linkDaPagina(1)} className="inline-flex min-h-11 min-w-11 items-center font-semibold text-brand-blue underline underline-offset-4">Ir para a primeira página</Link>
      </p>
    );
  }
  if (dados.usinas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
        {busca ? `Nenhuma usina encontrada para “${busca}”.` : 'Nenhuma usina ativa cadastrada ainda.'}
      </p>
    );
  }
  return (
    <>
      <TabelaDeUsinas usinas={dados.usinas} />
      <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} linkDaPagina={linkDaPagina} />
    </>
  );
}

// O regime vem da API; o nome do cliente leva ao detalhe da usina.
function TabelaDeUsinas({ usinas }: { usinas: UsinaDaLista[] }) {
  return (
    <Tabela legenda="Usinas ativas">
      <thead className={classeDoCabecalho}>
        <tr>
          <th scope="col">Cliente</th><th scope="col">Município/UF</th><th scope="col">kWp</th><th scope="col">Regime</th>
          <th scope="col">Protocolo</th><th scope="col">Conexão</th><th scope="col">Limpeza</th>
        </tr>
      </thead>
      <tbody>
        {usinas.map((usina) => (
          <tr key={usina.id} className={classeDaLinha}>
            <td>
              <Link to={`/admin/usinas/${usina.id}`} className="inline-flex min-h-11 min-w-11 items-center font-semibold text-brand-blue underline-offset-4 hover:underline">
                {usina.clienteNome}
              </Link>
            </td>
            <td className="whitespace-nowrap">{usina.municipio.nome}/{usina.municipio.uf}</td>
            <td className="tabular-nums whitespace-nowrap">{formatarNumero(usina.kwp, 3)}</td>
            <td className="whitespace-nowrap">{NOMES_DO_REGIME[usina.regime]}</td>
            <td className="whitespace-nowrap">{formatarData(usina.dataProtocolo)}</td>
            <td className="whitespace-nowrap">{formatarData(usina.dataConexao)}</td>
            <td className="whitespace-nowrap">A cada {usina.intervaloLimpezaMeses} meses</td>
          </tr>
        ))}
      </tbody>
    </Tabela>
  );
}
