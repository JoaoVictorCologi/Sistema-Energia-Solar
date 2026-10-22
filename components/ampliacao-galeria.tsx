"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { Foto } from "@/lib/fotos-data";
import type { VisualizadorFotoProps } from "@/components/visualizador-foto";

export function AmpliacaoGaleria({ containerId, fotos }: { containerId: string; fotos: readonly Foto[] }) {
  const [selecao, setSelecao] = useState<{ foto: Foto; origem: HTMLAnchorElement } | null>(null);
  const [Visualizador, setVisualizador] = useState<ComponentType<VisualizadorFotoProps> | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    let ativo = true;
    function abrir(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-foto-id]") : null;
      const selecionada = fotos.find(item => item.id === link?.dataset.fotoId);
      if (!link || !selecionada) return;
      event.preventDefault();
      setCarregando(true);
      // Sem JS, ou se o módulo falhar, o mesmo link abre a imagem completa.
      void import("./visualizador-foto").then(module => {
        if (!ativo) return;
        setVisualizador(() => module.VisualizadorFoto);
        setSelecao({ foto: selecionada, origem: link });
        setCarregando(false);
      }).catch(() => { if (ativo) window.location.assign(link.href); });
    }
    container.addEventListener("click", abrir);
    return () => { ativo = false; container?.removeEventListener("click", abrir); };
  }, [containerId, fotos]);

  return <>
    {carregando && <p role="status" className="sr-only">Abrindo fotografia.</p>}
    {Visualizador && selecao && <Visualizador foto={selecao.foto} origem={selecao.origem} onClose={() => setSelecao(null)} />}
  </>;
}
