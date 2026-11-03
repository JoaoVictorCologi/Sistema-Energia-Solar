import { useAuth } from '../../contexts/AuthContext.tsx';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';

// Provisório: as contagens de clientes, propostas e importações chegam com GET /api/admin/painel (tarefa 13).
export function Painel() {
  const { usuario } = useAuth();
  useTituloDaPagina('Painel — Solar Gestão');

  return (
    <>
      <p className="site-eyebrow">Área do administrador</p>
      <h1 className="font-heading text-3xl font-medium tracking-tight text-brand-blue">Olá, {usuario?.nome}.</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
        Você entrou como <strong className="font-semibold text-brand-ink">{usuario?.email}</strong>.
        Clientes, propostas e importações aparecem aqui conforme forem liberados.
      </p>
    </>
  );
}
