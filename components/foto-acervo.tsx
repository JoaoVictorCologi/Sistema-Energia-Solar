import Image from "next/image";
import { fotosAcervo } from "@/lib/fotos-data";

// Seleção para composição. O número do arquivo não define o perfil da obra.
export function FotoAcervo({ numero, className = "", loading = "lazy", sizes = "(min-width: 1200px) 550px, (min-width: 768px) 45vw, 100vw" }: { numero: string; className?: string; loading?: "eager" | "lazy"; sizes?: string }) {
  const foto = fotosAcervo.find(item => item.numero === numero);
  if (!foto) throw new Error("Fotografia do acervo não encontrada: " + numero);
  return <Image src={"/obras/otimizadas/obra-" + numero + "-640.webp"} width={640} height={640} sizes={sizes} alt={foto.alt} className={"aspect-[3/2] w-full rounded-md object-cover " + className} loading={loading} />;
}
