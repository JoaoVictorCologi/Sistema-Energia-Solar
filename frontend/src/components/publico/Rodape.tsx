import { Clock, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router';
import { empresa, linkDoWhatsApp } from '../../dados/empresa.ts';

const classeDoLink = 'inline-flex min-h-11 items-center underline underline-offset-4';

// Mesmos links e rótulos do rodapé do site anterior.
const linksDoRodape = [
  { rotulo: 'Soluções solares', caminho: '/solucoes' },
  { rotulo: 'Projetos e fotografias', caminho: '/projetos' },
  { rotulo: 'Simulador solar', caminho: '/simulador' },
  { rotulo: 'Fale com a Don Energy', caminho: '/contato' },
];

export function Rodape() {
  return (
    <footer className="bg-brand-blue-header text-white">
      <div className="site-shell py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.4fr_1fr]">
          <img src={empresa.logo.src} alt="Don Energy" width={empresa.logo.largura} height={empresa.logo.altura} loading="lazy" className="h-16 w-auto object-contain" />

          <div>
            <h2 className="font-heading text-sm font-semibold tracking-wide text-white/90 uppercase">Contato</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm text-white/90">
              <p className="flex items-start gap-2">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>{empresa.endereco.linha1}<br />{empresa.endereco.linha2}</span>
              </p>
              <a href={linkDoWhatsApp()} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 underline-offset-4 hover:underline">
                <Phone aria-hidden="true" className="size-4 shrink-0" /> {empresa.telefoneExibicao}
              </a>
            </div>
          </div>

          <div>
            <h2 className="font-heading text-sm font-semibold tracking-wide text-white/90 uppercase">Horário de funcionamento</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-white/90">
              {empresa.horarios.map((item) => (
                <li key={item.dias} className="flex items-start gap-2">
                  <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {item.dias}: {item.horario}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <nav aria-label="Navegação no rodapé" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          {linksDoRodape.map((item) => (
            <Link key={item.caminho} to={item.caminho} className={classeDoLink}>{item.rotulo}</Link>
          ))}
        </nav>

        <div className="mt-8 flex flex-col gap-x-6 border-t border-white/20 pt-6 text-sm text-white/90 sm:flex-row sm:flex-wrap sm:items-center">
          <Link to="/privacidade" className={classeDoLink}>Política de privacidade</Link>
          <Link to="/admin" className={classeDoLink}>Área do administrador</Link>
          <p className="py-3 sm:ml-auto">© {new Date().getFullYear()} Don Energy. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
