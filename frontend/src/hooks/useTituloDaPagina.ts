import { useEffect } from 'react';

// Título da aba por página; o do index.html vale até a primeira página abrir.
export function useTituloDaPagina(titulo: string): void {
  useEffect(() => {
    document.title = titulo;
  }, [titulo]);
}
