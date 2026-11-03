// Sem dependências: o script de demonstração confere o ambiente antes de carregar banco ou configuração.
// Em produção, só com --confirmar, porque o script apaga e recria os dados de demonstração.
export function conferirAmbiente(ambiente: string | undefined, argumentos: string[]): string | null {
  if (ambiente === 'production' && !argumentos.includes('--confirmar')) {
    return 'Recusado: NODE_ENV=production. Para criar dados de demonstração no banco de produção, rode com --confirmar.';
  }
  return null;
}
