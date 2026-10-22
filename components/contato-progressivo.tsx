"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function ContatoAlternativo() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h2 className="font-heading text-3xl font-bold sm:text-4xl">Peça sua proposta</h2>
      <p className="mt-3 text-muted-foreground">Converse com a Don Energy sobre o seu projeto.</p>
      <a href={buildWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 items-center rounded-md bg-brand-orange px-5 font-semibold text-brand-ink">Falar no WhatsApp</a>
    </div>
  );
}

// Importação condicional: RHF, Zod e os campos só são baixados perto do uso.
// A alternativa estática mantém o contato disponível mesmo sem JavaScript.
const FormularioContato = dynamic(
  () => import("./formulario-contato").then((module) => module.FormularioContato),
  { ssr: false, loading: ContatoAlternativo }
);

export function ContatoProgressivo() {
  const [carregar, setCarregar] = useState(false);
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setCarregar(true);
        observer.disconnect();
      }
    }, { rootMargin: "600px" });
    if (section.current) observer.observe(section.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="contato" ref={section} className="min-h-[760px] scroll-mt-[var(--header-height)] sm:min-h-[640px]">
      {carregar ? <FormularioContato /> : <ContatoAlternativo />}
    </section>
  );
}
