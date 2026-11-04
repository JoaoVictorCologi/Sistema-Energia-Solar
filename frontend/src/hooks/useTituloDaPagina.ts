import { useEffect } from 'react';

// Define o título da aba. O título do index.html vale até a primeira página abrir.
export function useTituloDaPagina(titulo: string): void {
  useEffect(() => {
    document.title = titulo;
  }, [titulo]);
}
