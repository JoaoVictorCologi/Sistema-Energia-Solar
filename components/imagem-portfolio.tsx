import type { Foto } from "@/lib/fotos-data";

export function ImagemPortfolio({ foto, ampliada = false }: { foto: Foto; ampliada?: boolean }) {
  const largura = ampliada ? 1440 : 480;
  return (
    // srcSet local: o export estático não depende de um otimizador de servidor.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ampliada ? foto.ampliacao : foto.miniatura}
      srcSet={foto.srcSet}
      sizes={ampliada ? "(min-width: 1200px) 1100px, 95vw" : "(min-width: 1200px) 350px, (min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"}
      width={largura}
      height={Math.round(largura * foto.altura / foto.largura)}
      alt={foto.alt}
      loading={ampliada ? "eager" : "lazy"}
      decoding="async"
      className={ampliada ? "max-h-[70svh] w-full object-contain" : "aspect-[3/2] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"}
    />
  );
}
