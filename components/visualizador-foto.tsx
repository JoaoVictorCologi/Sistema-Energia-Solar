"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRef } from "react";
import type { Foto } from "@/lib/fotos-data";
import { ImagemPortfolio } from "@/components/imagem-portfolio";

export type VisualizadorFotoProps = { foto: Foto; origem: HTMLAnchorElement; onClose: () => void };

export function VisualizadorFoto({ foto, origem, onClose }: VisualizadorFotoProps) {
  const fechar = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-brand-deep/85" />
        <Dialog.Popup initialFocus={fechar} finalFocus={() => origem} className="fixed top-1/2 left-1/2 z-[80] flex max-h-[calc(100%_-_2rem)] w-[calc(100%_-_2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-auto rounded-md border border-white/20 bg-brand-deep text-white shadow-xl">
          <div className="flex flex-col items-start justify-between gap-3 border-b sm:flex-row sm:items-center border-white/20 px-4 py-3 sm:px-6">
            <Dialog.Title className="font-heading text-base font-medium">Fotografia {foto.numero}</Dialog.Title>
            <Dialog.Close ref={fechar} aria-label="Fechar fotografia" className="inline-flex min-h-11 shrink-0 items-center rounded-sm border border-white/60 px-4 text-sm font-semibold hover:bg-white/10">Fechar <span aria-hidden="true" className="ml-3">×</span></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Fotografia do acervo Don Energy em enquadramento completo.</Dialog.Description>
          <figure className="min-h-0 p-3 sm:p-5"><ImagemPortfolio foto={foto} ampliada /><figcaption className="pt-4 text-center text-xs leading-relaxed text-white/90">{foto.legenda}</figcaption></figure>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
