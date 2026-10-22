"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { ContatoAlternativo } from "@/components/contato-progressivo";
import { perfilPorSlug } from "@/lib/perfis-solares";

const FormularioContato = dynamic(() => import("./formulario-contato").then((module) => module.FormularioContato), { ssr: false, loading: ContatoAlternativo });

export function ContatoPagina() {
  const query = useSearchParams();
  const perfil = perfilPorSlug(query.get("servico"));
  return <FormularioContato key={perfil?.id ?? "sem-perfil"} perfilInicial={perfil?.id} sectionId="campos-proposta" compacto />;
}
