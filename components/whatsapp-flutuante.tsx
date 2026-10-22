"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function WhatsappFlutuante() {
  const [oculto, setOculto] = useState(false);
  const atalho = useRef<HTMLAnchorElement>(null);
  const pathname = usePathname();
  const paginaComAtalho = pathname === "/" || /^\/servicos(?:\/|$)/.test(pathname);

  useEffect(() => {
    if (!paginaComAtalho) return;
    let frame = 0;
    const contato = document.getElementById("contato");
    const elementos = Array.from(document.querySelectorAll<HTMLElement>(
      "main h1, main h2, main h3, main p, main li, main label, main legend, main summary, main a, main button, main input, main select, main textarea, main figcaption, footer a, footer h3, footer address, footer dl, footer p"
    ));
    const atualizar = () => {
      frame = 0;
      const link = atalho.current;
      if (!link || document.activeElement === link) return;
      const areaContato = contato?.getBoundingClientRect();
      if (areaContato && areaContato.bottom > 0 && areaContato.top < innerHeight) {
        setOculto(true);
        return;
      }
      const area = link.getBoundingClientRect();
      const colide = (rect: DOMRect) => rect.width > 0 && rect.height > 0 && rect.right > area.left - 8 && rect.left < area.right + 8 && rect.bottom > area.top - 8 && rect.top < area.bottom + 8;
      // Medir só os blocos próximos. Textos usam suas linhas reais, não a largura vazia do parágrafo.
      setOculto(elementos.some(elemento => {
        if (!colide(elemento.getBoundingClientRect())) return false;
        if (elemento.matches("a, button, input, select, textarea, summary")) return true;
        const range = document.createRange();
        range.selectNodeContents(elemento);
        return Array.from(range.getClientRects()).some(colide);
      }));
    };
    const agendar = () => { if (!frame) frame = requestAnimationFrame(atualizar); };
    const observer = new ResizeObserver(agendar);
    document.querySelectorAll("main, footer").forEach(elemento => observer.observe(elemento));
    window.addEventListener("scroll", agendar, { passive: true });
    window.addEventListener("resize", agendar);
    document.addEventListener("focusout", agendar);
    void document.fonts.ready.then(agendar);
    agendar();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", agendar);
      window.removeEventListener("resize", agendar);
      document.removeEventListener("focusout", agendar);
    };
  }, [pathname, paginaComAtalho]);
  if (!paginaComAtalho) return null;
  return (
    <a
      ref={atalho}
      aria-hidden={oculto}
      tabIndex={oculto ? -1 : 0}
      href={buildWhatsAppUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className={(oculto ? "invisible pointer-events-none " : "") + "fixed right-6 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-brand-ink shadow-lg transition-transform hover:scale-105"}
    >
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        aria-hidden="true"
        className="size-7"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
      </svg>
    </a>
  );
}
