import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { comoOpcoes, NOMES_DO_CONTATO, NOMES_DO_HORARIO } from '../../dados/perguntasDoSimulador.ts';
import { ErroDaApi, pedirProposta, type ContatoPreferido, type MelhorHorario, type PedidoDeProposta as Pedido } from '../../services/api.ts';
import { CaixaDeAceite, CampoDeTexto, GrupoDeOpcoes } from '../formulario/Campos.tsx';

interface Dados {
  nome: string;
  email: string;
  telefone: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  contatoPreferido: ContatoPreferido | '';
  melhorHorario: MelhorHorario | '';
  aceite: boolean;
  autorizaCalibracao: boolean;
}

const DADOS_VAZIOS: Dados = {
  nome: '', email: '', telefone: '', logradouro: '', numero: '', complemento: '', bairro: '', contatoPreferido: '', melhorHorario: '', aceite: false, autorizaCalibracao: false,
};

// As chaves são os caminhos que a API usa em `fields`.
type Erros = Record<string, string>;

// Conferência antes do envio, com as mesmas regras do backend, que valida de novo.
function validar({ nome, email, telefone, logradouro, numero, complemento, bairro, aceite }: Dados): Erros {
  const erros: Erros = {};
  const digitos = telefone.replace(/\D/g, '').length;
  if (nome.trim().length < 2) erros.nome = 'Informe o nome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) erros.email = 'Informe um e-mail válido.';
  if (digitos < 10 || digitos > 11) erros.telefone = 'Informe o telefone com DDD.';
  if (logradouro.trim().length < 2 && (logradouro.trim() || numero.trim() || complemento.trim() || bairro.trim())) erros['endereco.logradouro'] = 'Informe a rua.';
  if (!aceite) erros.aceite = 'É preciso aceitar o uso dos dados para receber a proposta.';
  return erros;
}

const textoOpcional = (texto: string) => texto.trim() || undefined;

function montarPedido(codigo: string, dados: Dados): Pedido {
  return {
    simulacao: codigo, nome: dados.nome.trim(), email: dados.email.trim(), telefone: dados.telefone, aceite: dados.aceite,
    ...(dados.logradouro.trim() && {
      endereco: { logradouro: dados.logradouro.trim(), numero: textoOpcional(dados.numero), complemento: textoOpcional(dados.complemento), bairro: textoOpcional(dados.bairro) },
    }),
    ...(dados.contatoPreferido && { contatoPreferido: dados.contatoPreferido }),
    ...(dados.melhorHorario && { melhorHorario: dados.melhorHorario }),
    // Enviada apenas quando marcada: sem ela, o pedido segue normalmente (LGPD).
    ...(dados.autorizaCalibracao && { autorizaUsoParaCalibracao: true }),
  };
}

// Pedido de proposta: cria o cliente ligado a esta simulação. Cada simulação aceita um único pedido.
export function PedidoDeProposta({ codigoDaSimulacao, local }: { codigoDaSimulacao: string; local: { cidade: string; uf: string } }) {
  const [dados, setDados] = useState(DADOS_VAZIOS);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const mudar = (mudanca: Partial<Dados>) => setDados((atual) => ({ ...atual, ...mudanca }));

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const encontrados = validar(dados);
    setErros(encontrados);
    setErroGeral(null);
    if (Object.keys(encontrados).length > 0) return;
    setEnviando(true);
    try {
      setConfirmacao(await pedirProposta(montarPedido(codigoDaSimulacao, dados)));
    } catch (falha) {
      const erro = falha instanceof ErroDaApi ? falha : new ErroDaApi(0, 'ERRO_INTERNO', 'Algo deu errado. Tente de novo.');
      setErros(erro.campos);
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
          Esta simulação é uma estimativa. O valor final vem no orçamento dos nossos especialistas, depois da análise do local e, quando preciso, de uma visita técnica.
        </p>
      </div>
      <CamposDeContato dados={dados} mudar={mudar} erros={erros} />
      <CamposDoEndereco dados={dados} mudar={mudar} erros={erros} local={local} />
      <GrupoDeOpcoes nome="contatoPreferido" legenda="Como prefere ser contatado? (opcional)" opcoes={comoOpcoes(NOMES_DO_CONTATO)} valor={dados.contatoPreferido}
        aoMudar={(contatoPreferido) => mudar({ contatoPreferido })} erro={erros.contatoPreferido} />
      <GrupoDeOpcoes nome="melhorHorario" legenda="Melhor horário (opcional)" opcoes={comoOpcoes(NOMES_DO_HORARIO)} valor={dados.melhorHorario}
        aoMudar={(melhorHorario) => mudar({ melhorHorario })} erro={erros.melhorHorario} />
      <CaixaDeAceite id="proposta-aceite" marcado={dados.aceite} aoMudar={(aceite) => mudar({ aceite })} erro={erros.aceite}>
        Aceito que a Don Energy guarde meus dados e esta simulação para preparar a proposta, conforme a{' '}
        <Link to="/privacidade" className="underline underline-offset-4">política de privacidade</Link>.
      </CaixaDeAceite>
      <CaixaDeAceite id="proposta-calibracao" marcado={dados.autorizaCalibracao} aoMudar={(autorizaCalibracao) => mudar({ autorizaCalibracao })}>
        Opcional: autorizo usar os dados da minha simulação, sem me identificar, para melhorar o simulador. O pedido segue normalmente sem esta autorização.
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

interface PropriedadesDosCampos {
  dados: Dados;
  mudar: (mudanca: Partial<Dados>) => void;
  erros: Erros;
}

function CamposDeContato({ dados, mudar, erros }: PropriedadesDosCampos) {
  return (
    <>
      <CampoDeTexto id="proposta-nome" rotulo="Nome" autoComplete="name" value={dados.nome} erro={erros.nome} onChange={(evento) => mudar({ nome: evento.target.value })} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoDeTexto id="proposta-email" rotulo="E-mail" type="email" autoComplete="email" value={dados.email} erro={erros.email}
          onChange={(evento) => mudar({ email: evento.target.value })} />
        <CampoDeTexto id="proposta-telefone" rotulo="Telefone ou WhatsApp (com DDD)" type="tel" autoComplete="tel" value={dados.telefone} erro={erros.telefone}
          onChange={(evento) => mudar({ telefone: evento.target.value })} />
      </div>
    </>
  );
}

function CamposDoEndereco({ dados, mudar, erros, local }: PropriedadesDosCampos & { local: { cidade: string; uf: string } }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-sm font-semibold text-brand-ink">Endereço da instalação (opcional)</legend>
      <p className="-mt-2 text-sm text-muted-foreground">Em {local.cidade} / {local.uf}, pelo CEP informado. Ajuda a preparar o orçamento e a visita.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
        <CampoDeTexto id="proposta-logradouro" rotulo="Rua" autoComplete="address-line1" value={dados.logradouro} erro={erros['endereco.logradouro']}
          onChange={(evento) => mudar({ logradouro: evento.target.value })} />
        <CampoDeTexto id="proposta-numero" rotulo="Número" value={dados.numero} erro={erros['endereco.numero']} onChange={(evento) => mudar({ numero: evento.target.value })} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoDeTexto id="proposta-complemento" rotulo="Complemento" autoComplete="address-line2" value={dados.complemento} erro={erros['endereco.complemento']}
          onChange={(evento) => mudar({ complemento: evento.target.value })} />
        <CampoDeTexto id="proposta-bairro" rotulo="Bairro" value={dados.bairro} erro={erros['endereco.bairro']} onChange={(evento) => mudar({ bairro: evento.target.value })} />
      </div>
    </fieldset>
  );
}
