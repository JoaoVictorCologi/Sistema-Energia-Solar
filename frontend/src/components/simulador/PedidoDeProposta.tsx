import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ErroDaApi, pedirProposta } from '../../services/api.ts';
import { CaixaDeAceite, CampoDeTexto } from '../formulario/Campos.tsx';

type Campo = 'nome' | 'email' | 'telefone' | 'aceite';
type Erros = Partial<Record<Campo, string>>;

// Conferência antes de enviar, com as mesmas regras do backend (que valida de novo).
function validar(nome: string, email: string, telefone: string, aceite: boolean): Erros {
  const erros: Erros = {};
  const digitos = telefone.replace(/\D/g, '').length;
  if (nome.trim().length < 2) erros.nome = 'Informe o nome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) erros.email = 'Informe um e-mail válido.';
  if (digitos < 10 || digitos > 11) erros.telefone = 'Informe o telefone com DDD.';
  if (!aceite) erros.aceite = 'É preciso aceitar o uso dos dados para receber a proposta.';
  return erros;
}

// "Quero uma proposta" (tarefa 12): cria o cliente ligado a esta simulação. Cada simulação aceita um pedido só.
export function PedidoDeProposta({ codigoDaSimulacao }: { codigoDaSimulacao: string }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [aceite, setAceite] = useState(false);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const encontrados = validar(nome, email, telefone, aceite);
    setErros(encontrados);
    setErroGeral(null);
    if (Object.keys(encontrados).length > 0) return;
    setEnviando(true);
    try {
      setConfirmacao(await pedirProposta({ simulacao: codigoDaSimulacao, nome: nome.trim(), email: email.trim(), telefone, aceite }));
    } catch (falha) {
      const erro = falha instanceof ErroDaApi ? falha : new ErroDaApi(0, 'ERRO_INTERNO', 'Algo deu errado. Tente de novo.');
      setErros(erro.campos as Erros);
      if (Object.keys(erro.campos).length === 0) setErroGeral(erro.message);
    } finally {
      setEnviando(false);
    }
  }

  if (confirmacao) {
    return (
      <div role="status" className="rounded-md border border-border bg-white p-6 sm:p-8">
        <h2 className="font-heading text-2xl font-medium tracking-tight text-brand-blue">Pedido enviado</h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">{confirmacao}</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-6 rounded-md border border-border bg-white p-6 sm:p-8">
      <div>
        <h2 className="font-heading text-2xl font-medium tracking-tight text-brand-blue">Quero uma proposta</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          A equipe confere o local, os equipamentos e o preço, e envia a proposta com base nesta simulação.
        </p>
      </div>
      <CampoDeTexto id="proposta-nome" rotulo="Nome" autoComplete="name" value={nome} erro={erros.nome}
        onChange={(evento) => setNome(evento.target.value)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoDeTexto id="proposta-email" rotulo="E-mail" type="email" autoComplete="email" value={email} erro={erros.email}
          onChange={(evento) => setEmail(evento.target.value)} />
        <CampoDeTexto id="proposta-telefone" rotulo="Telefone ou WhatsApp (com DDD)" type="tel" autoComplete="tel" value={telefone}
          erro={erros.telefone} onChange={(evento) => setTelefone(evento.target.value)} />
      </div>
      <CaixaDeAceite id="proposta-aceite" marcado={aceite} aoMudar={setAceite} erro={erros.aceite}>
        Aceito que a Don Energy guarde meus dados e esta simulação para preparar a proposta, conforme a{' '}
        <Link to="/privacidade" className="underline underline-offset-4">política de privacidade</Link>.
      </CaixaDeAceite>
      {erroGeral && (
        <p role="alert" className="rounded-sm border border-red-700/30 bg-red-50 px-3 py-2 text-sm text-red-800">{erroGeral}</p>
      )}
      <button type="submit" disabled={enviando} className="site-button self-start disabled:opacity-70">
        {enviando ? 'Enviando…' : 'Pedir minha proposta'}
      </button>
    </form>
  );
}
