"use client";

import dynamic from "next/dynamic";
import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/lib/site-config";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

// A altura e a posição ficam constantes; apenas a superfície muda ao rolar.
function subscribeHeaderScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

const getHeaderScroll = () => window.scrollY > 16;
const getServerHeaderScroll = () => false;

const MenuMobile = dynamic(() => import("./menu-mobile").then((module) => module.MenuMobile), {
  ssr: false,
  loading: () => <span role="status" aria-label="Carregando menu" className="flex size-11 items-center justify-center rounded-md border border-white/40"><Menu aria-hidden="true" className="size-5" /></span>,
});

const links = [
  { href: "/", label: "Início" },
  { href: "/servicos/", label: "Soluções" },
  { href: "/obras/", label: "Projetos" },
  { href: "/simulador/", label: "Simulador" },
  { href: "/contato/", label: "Contato" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [menuAtivado, setMenuAtivado] = useState(false);
  const pathname = usePathname();
  const onHome = pathname === "/";
  const scrolled = useSyncExternalStore(subscribeHeaderScroll, getHeaderScroll, getServerHeaderScroll);
  const solid = !onHome || scrolled || open;

  useEffect(() => {
    // Não deixar um menu modal oculto prendendo o foco após ampliar a tela.
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  return (
    <>
    <header
      data-header-surface={solid ? "solid" : "overlay"}
      className={"fixed inset-x-0 top-0 z-50 text-white transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none " + (solid ? "bg-brand-blue-header shadow-sm" : "bg-transparent")}
    >
      <div className="site-shell flex items-center justify-between gap-4 py-[var(--header-py)]">
        <Link href="/" aria-label="Don Energy — página inicial" className="flex min-h-11 items-center gap-3 rounded-sm">
          <Image src={siteConfig.logo.src} alt="Don Energy" width={siteConfig.logo.width} height={siteConfig.logo.height} loading="eager" className="h-[var(--header-logo-size)] w-auto object-contain" />
        </Link>
        <nav aria-label="Navegação principal" className="hidden items-center gap-3 text-sm lg:gap-5 md:flex">
          {links.map((link) => <a key={link.href} href={link.href} aria-current={pathname === link.href || (link.href === "/servicos/" && pathname.startsWith("/servicos/")) ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium underline-offset-8 hover:underline aria-[current=page]:underline">{link.label}</a>)}
        </nav>
        <a href={buildWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="hidden min-h-11 items-center rounded-md bg-brand-orange px-4 text-sm font-semibold text-brand-ink hover:bg-brand-orange/90 md:inline-flex">Falar no WhatsApp</a>
        <div className="md:hidden">
          {menuAtivado ? <MenuMobile open={open} onOpenChange={setOpen} links={links} /> : (
            <button type="button" aria-haspopup="dialog" aria-expanded={false} aria-label="Abrir menu"
              onPointerEnter={() => { void import("./menu-mobile"); }}
              onFocus={() => { void import("./menu-mobile"); }}
              onClick={() => { setMenuAtivado(true); setOpen(true); }}
              className="flex size-11 items-center justify-center rounded-md border border-white/40">
              <Menu aria-hidden="true" className="size-5" />
            </button>
          )}
        </div>
      </div>
    </header>
    {/* Nas internas, reservar a altura desde o HTML inicial, sem salto ao hidratar. */}
    {!onHome && <div aria-hidden="true" className="h-[var(--header-height)] shrink-0" />}
    </>
  );
}
