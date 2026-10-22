"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ContextoSimulador } from "@/lib/simulador-contexto";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { perfisSolares, type PerfilSolarId } from "@/lib/perfis-solares";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const tiposImovel = perfisSolares.map((s) => ({ id: s.id, titulo: s.titulo }));

const schema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome"),
  telefone: z.string().trim().regex(/^\+?[\d\s().-]+$/, "Informe um telefone válido com DDD").refine((value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 13;
  }, "Informe um telefone válido com DDD"),
  tipoImovel: z.enum(
    ["residencial", "comercial", "rural", "usina"],
    "Selecione o perfil solar"
  ),
  consumoOuConta: z.string().trim().optional(),
  cidade: z.string().trim().min(2, "Informe sua cidade"),
  consentimento: z.literal(true, "É necessário concordar com a política de privacidade para continuar."),
});

type FormValues = z.infer<typeof schema>;

const tituloPorId = Object.fromEntries(
  tiposImovel.map((t) => [t.id, t.titulo])
) as Record<FormValues["tipoImovel"], string>;

function montarMensagem(dados: FormValues, contexto?: ContextoSimulador) {
  const linhas = [
    "Olá! Gostaria de solicitar uma proposta de energia solar.",
    "",
    `Nome: ${dados.nome}`,
    `Telefone: ${dados.telefone}`,
    `Perfil solar: ${tituloPorId[dados.tipoImovel]}`,
    `Cidade: ${dados.cidade}`,
  ];
  if (dados.consumoOuConta) {
    linhas.push(`Consumo/conta: ${dados.consumoOuConta}`);
  }
  if (contexto) {
    linhas.push("", "Origem: preparação no simulador — dados informados pelo visitante, sem estimativa calculada.", "Ligação informada: " + contexto.ligacao);
  }
  return linhas.join("\n");
}

export function FormularioContato({ perfilInicial, contextoInicial, sectionId = "formulario-proposta", compacto = false }: { perfilInicial?: PerfilSolarId; contextoInicial?: ContextoSimulador; sectionId?: string; compacto?: boolean }) {
  const [enviado, setEnviado] = useState(false);
  const [contextoDaMensagem, setContextoDaMensagem] = useState(contextoInicial);
  const [urlWhatsapp, setUrlWhatsapp] = useState("");
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      telefone: "",
      tipoImovel: (contextoInicial?.perfil ?? perfilInicial ?? "") as FormValues["tipoImovel"],
      consumoOuConta: contextoInicial?.consumoOuConta ?? "",
      cidade: contextoInicial?.cidade ?? "",
      consentimento: false as unknown as true,
    },
  });

  // O contexto só muda por atualização explícita no simulador. Preservar nome,
  // telefone, consentimento e o rascunho quando a revisão é reaberta.
  useEffect(() => {
    if (!contextoInicial) return;
    setValue("tipoImovel", contextoInicial.perfil);
    setValue("cidade", contextoInicial.cidade);
    setValue("consumoOuConta", contextoInicial.consumoOuConta);
  }, [contextoInicial, setValue]);

  function onSubmitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Checagem síncrona antes de decidir se abre a aba: o schema do Zod é
    // síncrono, mas o resolver do RHF expõe validação assíncrona por
    // convenção — se a gente esperasse handleSubmit terminar pra só então
    // chamar window.open, o navegador já não consideraria mais isso
    // "dentro do clique do usuário" e bloquearia como pop-up. Por isso só
    // abrimos a aba quando já sabemos, de forma síncrona, que os dados são
    // válidos (evita também abrir/fechar aba em branco à toa a cada
    // tentativa inválida).
    const resultado = schema.safeParse(getValues());

    if (!resultado.success) {
      // Ainda assim roda a validação do RHF, só pra popular as mensagens
      // de erro visuais nos campos (FieldError) — não abre aba nenhuma.
      handleSubmit(() => {})(event);
      return;
    }

    // Sem "noopener" aqui de propósito: passar noopener faz window.open
    // retornar null, e a gente precisa da referência pra navegar a aba
    // depois. Em vez disso, zera popup.opener manualmente (ainda
    // funciona porque about:blank é same-origin nesse instante) — mesma
    // proteção contra tabnabbing, sem perder a referência.
    const popup = window.open("", "_blank");
    const url = buildWhatsAppUrl(montarMensagem(resultado.data, contextoInicial));
    setUrlWhatsapp(url);
    if (popup) {
      popup.opener = null;
      popup.location.href = url;
    }
    setContextoDaMensagem(contextoInicial);
    setEnviado(true);
  }

  if (enviado && contextoDaMensagem === contextoInicial) {
    return (
      <section
        id={sectionId}
        className="scroll-mt-[var(--header-height)] bg-background px-6 py-20"
      >
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Sua mensagem está pronta
          </h2>
          <p className="mt-3 text-muted-foreground">
            O envio é feito por você no WhatsApp. Se a aba não abriu, use o link abaixo para continuar.
          </p>
          <a
            href={urlWhatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm text-brand-blue underline underline-offset-4"
          >
            Continuar no WhatsApp
          </a>
        </div>
      </section>
    );
  }

  return (
    // pb-32 (em vez de py-20 simétrico) só abaixo de sm: dá mais respiro
    // depois do botão de enviar em mobile, pra reduzir a chance do botão
    // flutuante do WhatsApp (bottom-right, fixed) cobrir o link de
    // "política de privacidade" ou o canto do botão numa posição de
    // scroll específica — confirmado visualmente na Fase 1.13.
    <section
      id={sectionId}
      className={compacto ? "rounded-md border border-border bg-background p-6 sm:p-8" : "site-section scroll-mt-[var(--header-height)] bg-brand-soft px-6 pb-24"}
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="font-heading text-2xl font-medium tracking-tight text-brand-blue sm:text-3xl">
          Peça sua proposta
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Preencha os dados para preparar sua mensagem no WhatsApp. O envio é feito por você.
        </p>
        <form onSubmit={onSubmitForm} noValidate className="mt-10">
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.nome}>
                <FieldLabel htmlFor="nome">Nome</FieldLabel>
                <Input
                  id="nome"
                  autoComplete="name"
                  aria-invalid={!!errors.nome}
                  aria-describedby={errors.nome ? "erro-nome" : undefined}
                  {...register("nome")}
                />
                <FieldError id="erro-nome" errors={[errors.nome]} />
              </Field>
              <Field data-invalid={!!errors.telefone}>
                <FieldLabel htmlFor="telefone">Telefone ou WhatsApp (com DDD)</FieldLabel>
                <Input
                  id="telefone"
                  type="tel"
                  autoComplete="tel"
                  aria-invalid={!!errors.telefone}
                  aria-describedby={errors.telefone ? "erro-telefone" : undefined}
                  {...register("telefone")}
                />
                <FieldError id="erro-telefone" errors={[errors.telefone]} />
              </Field>
            </div>

            <FieldSet>
              <FieldLegend variant="label">Perfil do projeto solar</FieldLegend>
              <Controller
                control={control}
                name="tipoImovel"
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    aria-invalid={!!errors.tipoImovel}
                    aria-describedby={errors.tipoImovel ? "erro-tipoImovel" : undefined}
                    className={cn(
                      "grid grid-cols-1 gap-3 rounded-lg min-[380px]:grid-cols-2",
                      errors.tipoImovel &&
                        "border border-destructive p-3 ring-3 ring-destructive/20"
                    )}
                  >
                    {tiposImovel.map((tipo) => {
                      return (
                        <FieldLabel key={tipo.id} htmlFor={`tipo-${tipo.id}`}>
                          <Field orientation="horizontal">
                            <RadioGroupItem value={tipo.id} id={`tipo-${tipo.id}`} />
                            {tipo.titulo}
                          </Field>
                        </FieldLabel>
                      );
                    })}
                  </RadioGroup>
                )}
              />
              <FieldError id="erro-tipoImovel" errors={[errors.tipoImovel]} />
            </FieldSet>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.cidade}>
                <FieldLabel htmlFor="cidade">Cidade</FieldLabel>
                <Input
                  id="cidade"
                  autoComplete="address-level2"
                  aria-invalid={!!errors.cidade}
                  aria-describedby={errors.cidade ? "erro-cidade" : undefined}
                  {...register("cidade")}
                />
                <FieldError id="erro-cidade" errors={[errors.cidade]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="consumoOuConta">
                  Consumo mensal (kWh) ou conta de energia (R$) — opcional
                </FieldLabel>
                <Input id="consumoOuConta" placeholder="Ex.: 450 kWh/mês ou R$ 350/mês" {...register("consumoOuConta")} />
              </Field>
            </div>

            <Field
              orientation="horizontal"
              data-invalid={!!errors.consentimento}
            >
              <Controller
                control={control}
                name="consentimento"
                render={({ field }) => (
                  <Checkbox
                    id="consentimento"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    aria-invalid={!!errors.consentimento}
                    aria-describedby={errors.consentimento ? "erro-consentimento" : undefined}
                  />
                )}
              />
              <FieldLabel htmlFor="consentimento" className="font-normal">
                Concordo com o tratamento dos meus dados conforme a{" "}
                {/* prefetch=false: rota nested (/privacidade) — o export
                    estático do Next 16.2.10 gera o payload de prefetch com
                    um path diferente do que o client pede, 404 sempre no
                    console em produção. Link funciona normal ao clicar. */}
                <Link
                  href="/privacidade/"
                  prefetch={false}
                  className="underline underline-offset-4"
                >
                  política de privacidade
                </Link>
                .
              </FieldLabel>
            </Field>
            <FieldError id="erro-consentimento" errors={[errors.consentimento]} />

            <Button
              type="submit"
              size="lg"
              className="min-h-12 bg-brand-orange text-brand-ink hover:bg-brand-orange/90"
            >
              Quero minha proposta
            </Button>
          </FieldGroup>
        </form>
      </div>
    </section>
  );
}
