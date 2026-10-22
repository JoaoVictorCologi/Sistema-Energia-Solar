import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { Clock, MapPin, Phone } from "lucide-react";
import Image from "next/image";

import { contato } from "@/lib/contato-data";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function Footer() {
  return (
    <footer className="bg-brand-blue-header text-white">
      <div className="site-shell py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.4fr_1fr]">
          <div>
            <Image
              src={siteConfig.logo.src}
              alt="Don Energy"
              width={siteConfig.logo.width}
              height={siteConfig.logo.height}
              className="h-16 w-auto object-contain" loading="lazy"
            />
          </div>

          <div>
            <h3 className="font-heading text-sm font-semibold tracking-wide text-white/90 uppercase">
              Contato
            </h3>
            <div className="mt-3 flex flex-col gap-2 text-sm text-white/90">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>
                  {contato.endereco.linha1}
                  <br />
                  {contato.endereco.linha2}
                </span>
              </div>
              <a
                href={buildWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 underline-offset-4 hover:underline"
              >
                <Phone className="size-4 shrink-0" />
                {contato.telefoneExibicao}
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-heading text-sm font-semibold tracking-wide text-white/90 uppercase">
              Horário de funcionamento
            </h3>
            <div className="mt-3 flex flex-col gap-2 text-sm text-white/90">
              {contato.horarios.map((item) => (
                <div key={item.dias} className="flex items-start gap-2">
                  <Clock className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {item.dias}: {item.horario}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <nav aria-label="Navegação no rodapé" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold"><Link prefetch={false} href="/servicos/" className="inline-flex min-h-11 items-center underline underline-offset-4">Soluções solares</Link><Link prefetch={false} href="/obras/" className="inline-flex min-h-11 items-center underline underline-offset-4">Projetos e fotografias</Link><Link prefetch={false} href="/simulador/" className="inline-flex min-h-11 items-center underline underline-offset-4">Simulador solar</Link><Link prefetch={false} href="/contato/" className="inline-flex min-h-11 items-center underline underline-offset-4">Fale com a Don Energy</Link></nav>

        <div className="mt-8 border-t border-white/20 pt-6 text-sm text-white/90">
          <Link href="/privacidade/" prefetch={false} className="mb-4 inline-flex min-h-11 items-center underline underline-offset-4">Política de privacidade</Link>
          <p>© {new Date().getFullYear()} Don Energy. Todos os direitos
          reservados.</p>
        </div>
      </div>
    </footer>
  );
}
