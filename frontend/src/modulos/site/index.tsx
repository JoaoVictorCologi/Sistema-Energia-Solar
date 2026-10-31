import { EmConstrucao } from '../../components/EmConstrucao.tsx';
import type { ModuloDoFrontend } from '../index.ts';
import { Contato } from './pages/Contato.tsx';
import { Inicio } from './pages/Inicio.tsx';

// Plano 6 — Site institucional. Início e Contato vieram do site Don Energy e já funcionam sem backend
// (o contato abre o WhatsApp). Quem somos, Perguntas frequentes e a caixa de mensagens entram com o plano.
export const moduloSite: ModuloDoFrontend = {
  rotasPublicas: [
    { caminho: '/', elemento: <Inicio /> },
    { caminho: '/contato', elemento: <Contato /> },
  ],
  menuPublico: [
    { rotulo: 'Início', caminho: '/', ordem: 10 },
    { rotulo: 'Contato', caminho: '/contato', ordem: 90 },
  ],
  rotasAdmin: [{
    caminho: '/admin/mensagens',
    elemento: (
      <EmConstrucao
        titulo="Mensagens" origem="Plano 6 · Site institucional"
        descricao="Caixa das mensagens enviadas pelo formulário de contato do site, com filtro por status, marcação de respondida e exclusão a pedido do titular (LGPD)."
      />
    ),
  }],
  menuAdmin: [{ rotulo: 'Mensagens', caminho: '/admin/mensagens' }],
};
