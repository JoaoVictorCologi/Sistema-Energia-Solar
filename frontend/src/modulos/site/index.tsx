import { EmConstrucao } from '../../components/EmConstrucao.tsx';
import type { ModuloDoFrontend } from '../index.ts';
import { Contato } from './pages/Contato.tsx';
import { Inicio } from './pages/Inicio.tsx';

// Módulo do site institucional. Início e Contato funcionam sem backend (o contato abre o WhatsApp).
// A caixa de mensagens ainda é provisória.
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
        titulo="Mensagens" origem="Site institucional"
        descricao="Caixa das mensagens enviadas pelo formulário de contato do site, com filtro por status, marcação de respondida e exclusão a pedido do titular (LGPD)."
      />
    ),
  }],
  menuAdmin: [{ rotulo: 'Mensagens', caminho: '/admin/mensagens' }],
};
