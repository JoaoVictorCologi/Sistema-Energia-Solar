import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { CaixaDeAceite, CampoDeTexto, GrupoDeOpcoes } from '../../../components/formulario/Campos.tsx';
import { linkDoWhatsApp } from '../../../dados/empresa.ts';
import { solucoes } from '../../../dados/solucoes.ts';

// O formulário apenas monta a mensagem e abre o WhatsApp; nada é gravado.

interface DadosDoContato {
  nome: string;
  telefone: string;
  perfil: string;
  cidade: string;
  consumoOuConta: string;
  consentimento: boolean;
}

type Erros = Partial<Record<keyof DadosDoContato, string>>;

function validarContato(dados: DadosDoContato): Erros {
  const erros: Erros = {};
  const digitosDoTelefone = dados.telefone.replace(/\D/g, '').length;
  if (dados.nome.trim().length < 2) erros.nome = 'Informe seu nome.';
  if (!/^\+?[\d\s().-]+$/.test(dados.telefone.trim()) || digitosDoTelefone < 10 || digitosDoTelefone > 13) {
    erros.telefone = 'Informe um telefone válido com DDD.';
  }
  if (!solucoes.some((solucao) => solucao.slug === dados.perfil)) erros.perfil = 'Selecione o perfil solar.';
  if (dados.cidade.trim().length < 2) erros.cidade = 'Informe sua cidade.';
  if (!dados.consentimento) erros.consentimento = 'É necessário concordar com a política de privacidade para continuar.';
  return erros;
}

function montarMensagem(dados: DadosDoContato): string {
  const perfil = solucoes.find((solucao) => solucao.slug === dados.perfil)?.titulo;
  const linhas = [
    'Olá! Gostaria de solicitar uma proposta de energia solar.',
    '',
    `Nome: ${dados.nome.trim()}`,
    `Telefone: ${dados.telefone.trim()}`,
    `Perfil solar: ${perfil}`,
    `Cidade: ${dados.cidade.trim()}`,
  ];
  if (dados.consumoOuConta.trim()) linhas.push(`Consumo/conta: ${dados.consumoOuConta.trim()}`);
  return linhas.join('\n');
}

function MensagemPronta({ link }: { link: string }) {
  return (
    <div role="status" className="mx-auto max-w-xl py-10 text-center">
      <h2 className="font-heading text-3xl font-medium tracking-tight text-brand-blue">Sua mensagem está pronta</h2>
      <p className="mt-3 text-muted-foreground">O envio é feito por você no WhatsApp. Se a aba não abriu, use o link abaixo para continuar.</p>
      <a href={link} target="_blank" rel="noopener noreferrer" className="site-link mt-4">Continuar no WhatsApp <span aria-hidden="true">↗</span></a>
    </div>
  );
}

// `compacto`: cartão com borda, na página de contato; sem ele, faixa cinza da página inicial.
export function FormularioContato({ perfilInicial = '', compacto = false }: { perfilInicial?: string; compacto?: boolean }) {
  const [dados, setDados] = useState<DadosDoContato>({
    nome: '', telefone: '', perfil: perfilInicial, cidade: '', consumoOuConta: '', consentimento: false,
  });
  const [erros, setErros] = useState<Erros>({});
  const [linkPronto, setLinkPronto] = useState<string | null>(null);

  function alterar<Campo extends keyof DadosDoContato>(campo: Campo, valor: DadosDoContato[Campo]) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const encontrados = validarContato(dados);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;
    const link = linkDoWhatsApp(montarMensagem(dados));
    // Precisa abrir dentro do clique: fora dele, o navegador bloquearia como pop-up.
    window.open(link, '_blank', 'noopener,noreferrer');
    setLinkPronto(link);
  }

  return (
    <div className={compacto ? 'rounded-md border border-border bg-background p-6 sm:p-8' : 'mx-auto max-w-3xl'}>
      {linkPronto ? <MensagemPronta link={linkPronto} /> : (
        <>
          <h2 className="font-heading text-2xl font-medium tracking-tight text-brand-blue sm:text-3xl">Peça sua proposta</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Preencha os dados para preparar sua mensagem no WhatsApp. O envio é feito por você.
          </p>
          <form onSubmit={enviar} noValidate className="mt-10 flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CampoDeTexto id="nome" rotulo="Nome" autoComplete="name" value={dados.nome} erro={erros.nome}
                onChange={(evento) => alterar('nome', evento.target.value)} />
              <CampoDeTexto id="telefone" rotulo="Telefone ou WhatsApp (com DDD)" type="tel" autoComplete="tel" value={dados.telefone}
                erro={erros.telefone} onChange={(evento) => alterar('telefone', evento.target.value)} />
            </div>

            <GrupoDeOpcoes nome="perfil" legenda="Perfil do projeto solar" valor={dados.perfil} erro={erros.perfil}
              opcoes={solucoes.map((solucao) => ({ valor: solucao.slug, rotulo: solucao.titulo }))}
              aoMudar={(perfil) => alterar('perfil', perfil)} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CampoDeTexto id="cidade" rotulo="Cidade" autoComplete="address-level2" value={dados.cidade} erro={erros.cidade}
                onChange={(evento) => alterar('cidade', evento.target.value)} />
              <CampoDeTexto id="consumoOuConta" rotulo="Consumo mensal (kWh) ou conta de energia (R$) — opcional"
                placeholder="Ex.: 450 kWh/mês ou R$ 350/mês" value={dados.consumoOuConta}
                onChange={(evento) => alterar('consumoOuConta', evento.target.value)} />
            </div>

            <CaixaDeAceite id="consentimento" marcado={dados.consentimento} erro={erros.consentimento}
              aoMudar={(marcado) => alterar('consentimento', marcado)}>
              Concordo com o tratamento dos meus dados conforme a{' '}
              <Link to="/privacidade" className="underline underline-offset-4">política de privacidade</Link>.
            </CaixaDeAceite>

            <button type="submit" className="site-button self-start">Quero minha proposta</button>
          </form>
        </>
      )}
    </div>
  );
}
