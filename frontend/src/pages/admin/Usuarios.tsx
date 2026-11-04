import { useState, type FormEvent } from 'react';
import { Aviso, BotaoComConfirmacao, Cartao, classeDoBotaoPerigoso, classeDoBotaoSecundario, EstadoDaCarga, Titulo } from '../../components/admin/Pecas.tsx';
import { CampoDeSelecao, CampoDeTexto } from '../../components/formulario/Campos.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { mensagemGeral, useAcao } from '../../hooks/useAcao.ts';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { alterarUsuario, cadastrarUsuario, excluirUsuario, listarUsuarios, redefinirSenha, type Papel, type UsuarioDaEquipe } from '../../services/api.ts';
import { formatarDiaDoInstante } from '../../utils/formatar.ts';
import { ROTULOS_DO_PAPEL } from '../../utils/papeis.ts';

type PapelEditavel = Exclude<Papel, 'admin'>;

// O admin é criado apenas por script; gestores são criados pelo admin, e operadores, pela gestão.
function papeisQuePodeAtribuir(papelDeQuemEdita: Papel | undefined): PapelEditavel[] {
  return papelDeQuemEdita === 'admin' ? ['operador', 'gestor'] : ['operador'];
}

function SelecaoDePapel({ id, papeis, valor, aoMudar, erro }: { id: string; papeis: PapelEditavel[]; valor: PapelEditavel; aoMudar: (papel: PapelEditavel) => void; erro?: string }) {
  return (
    <CampoDeSelecao id={id} rotulo="Papel" value={valor} erro={erro} onChange={(evento) => aoMudar(evento.target.value as PapelEditavel)}>
      {papeis.map((papel) => <option key={papel} value={papel}>{ROTULOS_DO_PAPEL[papel]}</option>)}
    </CampoDeSelecao>
  );
}

function NovoUsuario({ aoCadastrar }: { aoCadastrar: () => void }) {
  const { usuario } = useAuth();
  const vazio = { nome: '', email: '', senha: '', papel: 'operador' as PapelEditavel };
  const [campos, setCampos] = useState(vazio);
  const { executar, ocupado, erro } = useAcao();
  const mudar = (mudanca: Partial<typeof vazio>) => setCampos((atual) => ({ ...atual, ...mudanca }));

  async function cadastrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const criado = await executar(() => cadastrarUsuario({ ...campos, nome: campos.nome.trim(), email: campos.email.trim() }));
    if (criado) { setCampos(vazio); aoCadastrar(); }
  }

  return (
    <Cartao>
      <h2 className="font-heading text-lg font-medium text-brand-blue">Novo usuário</h2>
      <form onSubmit={cadastrar} noValidate className="mt-4 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoDeTexto id="novo-nome" rotulo="Nome" autoComplete="off" value={campos.nome} erro={erro?.campos.nome} onChange={(evento) => mudar({ nome: evento.target.value })} />
          <CampoDeTexto id="novo-email" rotulo="E-mail" type="email" autoComplete="off" value={campos.email} erro={erro?.campos.email} onChange={(evento) => mudar({ email: evento.target.value })} />
          <CampoDeTexto id="novo-senha" rotulo="Senha inicial" type="password" autoComplete="new-password" value={campos.senha} erro={erro?.campos.senha} ajuda="De 10 a 72 caracteres." onChange={(evento) => mudar({ senha: evento.target.value })} />
          <SelecaoDePapel id="novo-papel" papeis={papeisQuePodeAtribuir(usuario?.papel)} valor={campos.papel} erro={erro?.campos.papel} aoMudar={(papel) => mudar({ papel })} />
        </div>
        {mensagemGeral(erro) && <Aviso>{mensagemGeral(erro)}</Aviso>}
        <button type="submit" disabled={ocupado} className={classeDoBotaoSecundario + ' self-start'}>{ocupado ? 'Cadastrando…' : 'Cadastrar usuário'}</button>
      </form>
    </Cartao>
  );
}

function EditarUsuario({ alvo, aoSalvar }: { alvo: UsuarioDaEquipe & { papel: PapelEditavel }; aoSalvar: () => void }) {
  const { usuario } = useAuth();
  const [campos, setCampos] = useState({ nome: alvo.nome, email: alvo.email, papel: alvo.papel });
  const { executar, ocupado, erro } = useAcao();
  const mudar = (mudanca: Partial<typeof campos>) => setCampos((atual) => ({ ...atual, ...mudanca }));
  // A própria conta não muda de papel, para evitar a perda acidental de acesso. O papel atual permanece na lista.
  const papeis = usuario?.id === alvo.id ? [alvo.papel] : [...new Set([alvo.papel, ...papeisQuePodeAtribuir(usuario?.papel)])];

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const salvo = await executar(() => alterarUsuario(alvo.id, {
      ...(campos.nome.trim() !== alvo.nome && { nome: campos.nome.trim() }),
      ...(campos.email.trim() !== alvo.email && { email: campos.email.trim() }),
      ...(campos.papel !== alvo.papel && { papel: campos.papel }),
    }));
    if (salvo) aoSalvar();
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoDeTexto id={`editar-nome-${alvo.id}`} rotulo="Nome" value={campos.nome} erro={erro?.campos.nome} onChange={(evento) => mudar({ nome: evento.target.value })} />
        <CampoDeTexto id={`editar-email-${alvo.id}`} rotulo="E-mail" type="email" value={campos.email} erro={erro?.campos.email} onChange={(evento) => mudar({ email: evento.target.value })} />
        <SelecaoDePapel id={`editar-papel-${alvo.id}`} papeis={papeis} valor={campos.papel} erro={erro?.campos.papel} aoMudar={(papel) => mudar({ papel })} />
      </div>
      {mensagemGeral(erro) && <Aviso>{mensagemGeral(erro)}</Aviso>}
      <button type="submit" disabled={ocupado} className={classeDoBotaoSecundario + ' self-start'}>{ocupado ? 'Salvando…' : 'Salvar alterações'}</button>
    </form>
  );
}

function NovaSenha({ alvo }: { alvo: UsuarioDaEquipe }) {
  const [senha, setSenha] = useState('');
  const [trocada, setTrocada] = useState(false);
  const { executar, ocupado, erro } = useAcao();

  async function trocar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setTrocada(false);
    const pronto = await executar(async () => { await redefinirSenha(alvo.id, senha); return true; });
    if (pronto) { setSenha(''); setTrocada(true); }
  }

  return (
    <form onSubmit={trocar} noValidate className="flex flex-col gap-3">
      <CampoDeTexto id={`senha-${alvo.id}`} rotulo="Nova senha" type="password" autoComplete="new-password" value={senha} erro={erro?.campos.senha} ajuda="De 10 a 72 caracteres." onChange={(evento) => setSenha(evento.target.value)} />
      {mensagemGeral(erro) && <Aviso>{mensagemGeral(erro)}</Aviso>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={ocupado} className={classeDoBotaoSecundario}>{ocupado ? 'Salvando…' : 'Redefinir senha'}</button>
        {trocada && <span role="status" className="text-sm text-muted-foreground">Senha redefinida.</span>}
      </div>
    </form>
  );
}

// Excluir é desativar: o login é bloqueado, e a conta continua ligada ao histórico dos orçamentos.
function ExcluirUsuario({ alvo, aoExcluir }: { alvo: UsuarioDaEquipe; aoExcluir: () => void }) {
  const { executar, ocupado, erro } = useAcao();

  async function excluir() {
    const pronto = await executar(async () => { await excluirUsuario(alvo.id); return true; });
    if (pronto) aoExcluir();
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">O login é bloqueado na hora. A conta continua no histórico dos orçamentos, e o e-mail não pode ser usado de novo.</p>
      <div><BotaoComConfirmacao rotulo="Excluir usuário" pergunta={`Excluir ${alvo.nome}?`} ocupado={ocupado} aoConfirmar={excluir} classe={classeDoBotaoPerigoso} /></div>
      {erro && <Aviso>{erro.message}</Aviso>}
    </div>
  );
}

function ItemDoUsuario({ alvo, aoMudar }: { alvo: UsuarioDaEquipe; aoMudar: () => void }) {
  const { usuario } = useAuth();
  const proprio = usuario?.id === alvo.id;
  return (
    <li>
      <details className="rounded-md border border-border bg-white">
        <summary className="flex min-h-12 cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <span className="font-semibold text-brand-blue">{alvo.nome}{proprio && ' (você)'}</span>
          <span className="break-all text-muted-foreground">{alvo.email}</span>
          <span className="font-medium">{ROTULOS_DO_PAPEL[alvo.papel]}</span>
          <span className="text-muted-foreground">desde {formatarDiaDoInstante(alvo.criadoEm)}</span>
        </summary>
        <div className="flex flex-col gap-6 border-t border-border p-4">
          {/* O usuário da TI é alterado apenas por script: a API recusa (403) qualquer alteração por aqui. */}
          {alvo.papel === 'admin'
            ? <p className="text-sm text-muted-foreground">O usuário da TI é criado e alterado só pelo script da equipe técnica.</p>
            : (
              <>
                <EditarUsuario alvo={alvo as UsuarioDaEquipe & { papel: PapelEditavel }} aoSalvar={aoMudar} />
                <NovaSenha alvo={alvo} />
                {!proprio && <ExcluirUsuario alvo={alvo} aoExcluir={aoMudar} />}
              </>
            )}
        </div>
      </details>
    </li>
  );
}

export function Usuarios() {
  useTituloDaPagina('Usuários — Solar Gestão');
  const carga = useCarregar(listarUsuarios, 'usuarios');

  return (
    <>
      <Titulo sobre="Quem acessa a área restrita">Usuários</Titulo>
      <div className="flex flex-col gap-8">
        <NovoUsuario aoCadastrar={carga.recarregar} />
        <EstadoDaCarga carregando={carga.carregando && !carga.dados} erro={carga.erro} aoTentarDeNovo={carga.recarregar} />
        {carga.dados && <ul className="flex flex-col gap-3">{carga.dados.map((alvo) => <ItemDoUsuario key={`${alvo.id}-${alvo.nome}-${alvo.email}-${alvo.papel}`} alvo={alvo} aoMudar={carga.recarregar} />)}</ul>}
      </div>
    </>
  );
}
