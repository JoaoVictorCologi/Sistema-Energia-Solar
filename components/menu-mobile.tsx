"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; links: ReadonlyArray<{ href: string; label: string }> };

export function MenuMobile({ open, onOpenChange, links }: Props) {
  const pathname = usePathname();
  return (
        <Popover open={open} onOpenChange={onOpenChange} modal="trap-focus">
          <PopoverTrigger aria-label={open ? "Fechar menu" : "Abrir menu"} className="flex size-11 items-center justify-center rounded-md border border-white/40 md:hidden">
            {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </PopoverTrigger>
          <PopoverContent aria-label="Menu de navegação" align="end" className="w-56 md:hidden">
            <PopoverClose className="flex min-h-11 items-center justify-center rounded-md text-sm font-medium hover:bg-muted">Fechar menu</PopoverClose>
            <nav aria-label="Navegação no celular" className="flex flex-col gap-1">
              {links.map((link) => <a key={link.href} href={link.href} aria-current={pathname === link.href || (link.href === "/servicos/" && pathname.startsWith("/servicos/")) ? "page" : undefined} onClick={() => onOpenChange(false)} className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-muted">{link.label}</a>)}
              <a href={buildWhatsAppUrl()} target="_blank" rel="noopener noreferrer" onClick={() => onOpenChange(false)} className="flex min-h-11 items-center rounded-md bg-brand-orange px-3 text-sm font-semibold text-brand-ink">Falar no WhatsApp</a>
            </nav>
          </PopoverContent>
        </Popover>
  );
}
