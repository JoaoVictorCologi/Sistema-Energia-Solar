import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { classeDaLinha, classeDoBotaoSecundario, classeDoCabecalho, EstadoDaCarga, Paginacao, Tabela, Titulo } from '../../components/admin/Pecas.tsx';
import { classeDoCampo } from '../../components/formulario/Campos.tsx';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { listarClientes } from '../../services/api.ts';
import { formatarDiaDoInstante } from '../../utils/formatar.ts';

// Busca e página ficam na URL: voltar do detalhe do cliente mantém a lista onde estava.
export function Clientes() {
  useTituloDaPagina('Clientes — Solar Gestão');
  const [parametros, setParametros] = useSearchParams();
  const busca = parametros.get('busca') ?? '';
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const [texto, setTexto] = useState(busca);
  const { dados, erro, carregando, recarregar } = useCarregar(() => listarClientes({ busca, pagina }), `${busca}|${pagina}`);

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setParametros(texto.trim() ? { busca: texto.trim() } : {});
  }

  const linkDaPagina = (numero: number) => `?${new URLSearchParams({ ...(busca ? { busca } : {}), pagina: String(numero) })}`;

  return (
    <>
      <Titulo sobre="Pedidos de proposta do site">Clientes</Titulo>
      <form onSubmit={buscar} role="search" className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor="busca" className="block text-sm font-semibold text-brand-ink">Buscar por nome ou e-mail</label>
          <input id="busca" type="search" value={texto} onChange={(evento) => setTexto(evento.target.value)} className={classeDoCampo} />
        </div>
        <button type="submit" className={classeDoBotaoSecundario + ' min-h-12'}><Search aria-hidden="true" className="size-4" /> Buscar</button>
      </form>

      <EstadoDaCarga carregando={carregando} erro={erro} aoTentarDeNovo={recarregar} />
      {dados && !carregando && (dados.clientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{busca ? `Nenhum cliente encontrado para “${busca}”.` : 'Nenhum pedido de proposta ainda.'}</p>
      ) : (
        <>
          <Tabela legenda="Clientes">
            <thead className={classeDoCabecalho}>
              <tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Telefone</th><th scope="col">Pedido em</th></tr>
            </thead>
            <tbody>
              {dados.clientes.map((cliente) => (
                <tr key={cliente.id} className={classeDaLinha}>
                  <td><Link to={`/admin/clientes/${cliente.id}`} className="font-semibold text-brand-blue underline-offset-4 hover:underline">{cliente.nome}</Link></td>
                  <td>{cliente.email}</td>
                  <td className="whitespace-nowrap">{cliente.telefone}</td>
                  <td className="whitespace-nowrap">{formatarDiaDoInstante(cliente.criadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
          <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} linkDaPagina={linkDaPagina} />
        </>
      ))}
    </>
  );
}
