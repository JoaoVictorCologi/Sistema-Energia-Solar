import { useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { Link } from 'react-router';
import { linkDoWhatsApp } from '../../../dados/empresa.ts';
import { solucoes } from '../../../dados/solucoes.ts';

// Herdado do site Don Energy: o formulário só monta a mensagem e abre o WhatsApp; nada é gravado.
// O Plano 6 (tarefas 2 e 3) troca o envio pelo POST /api/site/contato.

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

const classeDoCampo =
  'mt-2 block min-h-12 w-full rounded-sm border border-border bg-white px-3 text-base text-brand-ink aria-[invalid=true]:border-red-700';

function MensagemDeErro({ id, texto }: { id: string; texto?: string }) {
  return texto ? <p id={id} className="mt-1 text-sm text-red-800">{texto}</p> : null;
}

function CampoDeTexto({ id, rotulo, erro, ...propriedades }: { id: string; rotulo: string; erro?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-brand-ink">{rotulo}</label>
      <input
        id={id} aria-invalid={Boolean(erro)} aria-describedby={erro ? `erro-${id}` : undefined}
        className={classeDoCampo} {...propriedades}
      />
      <MensagemDeErro id={`erro-${id}`} texto={erro} />
    </div>
  );
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

// `compacto`: cartão com borda (página de contato); sem ele, faixa cinza da página inicial.
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
    // Abre ainda dentro do clique; fora dele, o navegador bloquearia como pop-up.
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

            <fieldset aria-describedby={erros.perfil ? 'erro-perfil' : undefined}>
              <legend className="text-sm font-semibold text-brand-ink">Perfil do projeto solar</legend>
              <div className="mt-2 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                {solucoes.map((solucao) => (
                  <label key={solucao.slug} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-border bg-white px-3 text-sm has-[:checked]:border-brand-blue has-[:checked]:text-brand-blue">
                    <input type="radio" name="perfil" value={solucao.slug} checked={dados.perfil === solucao.slug}
                      onChange={() => alterar('perfil', solucao.slug)} className="size-4 accent-brand-blue" />
                    {solucao.titulo}
                  </label>
                ))}
              </div>
              <MensagemDeErro id="erro-perfil" texto={erros.perfil} />
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CampoDeTexto id="cidade" rotulo="Cidade" autoComplete="address-level2" value={dados.cidade} erro={erros.cidade}
                onChange={(evento) => alterar('cidade', evento.target.value)} />
              <CampoDeTexto id="consumoOuConta" rotulo="Consumo mensal (kWh) ou conta de energia (R$) — opcional"
                placeholder="Ex.: 450 kWh/mês ou R$ 350/mês" value={dados.consumoOuConta}
                onChange={(evento) => alterar('consumoOuConta', evento.target.value)} />
            </div>

            <div>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={dados.consentimento} onChange={(evento) => alterar('consentimento', evento.target.checked)}
                  aria-invalid={Boolean(erros.consentimento)} aria-describedby={erros.consentimento ? 'erro-consentimento' : undefined}
                  className="mt-0.5 size-5 shrink-0 accent-brand-blue" />
                <span>Concordo com o tratamento dos meus dados conforme a{' '}
                  <Link to="/privacidade" className="underline underline-offset-4">política de privacidade</Link>.</span>
              </label>
              <MensagemDeErro id="erro-consentimento" texto={erros.consentimento} />
            </div>

            <button type="submit" className="site-button self-start">Quero minha proposta</button>
          </form>
        </>
      )}
    </div>
  );
}
