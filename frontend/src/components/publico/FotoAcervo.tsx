import { fotoPorNumero } from '../../dados/fotos.ts';

// Recorte de 640 px para composição de página; o número da foto não define o perfil da obra.
export function FotoAcervo({ numero, className = '', carregarJa = false }: { numero: string; className?: string; carregarJa?: boolean }) {
  const foto = fotoPorNumero(numero);
  return (
    <img
      src={`/fotos/otimizadas/obra-${numero}-640.webp`} width={640} height={427} alt={foto.alt}
      loading={carregarJa ? 'eager' : 'lazy'} decoding="async"
      className={'aspect-[3/2] w-full rounded-md object-cover ' + className}
    />
  );
}
