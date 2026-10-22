import { fotosAcervo, fotoPorId, type FotoId } from "@/lib/fotos-data";
import type { PerfilSolarId } from "@/lib/perfis-solares";

export type ObraConfirmada = {
  id: string;
  slug: string;
  agrupamentoConfirmado: true;
  titulo: string;
  descricao: string;
  fotoIds: readonly FotoId[];
  capaFotoId: FotoId;
  cidade?: string;
  uf?: string;
  potenciaKwp?: number;
  perfil?: PerfilSolarId;
  destaque?: number;
};

// Acrescentar apenas agrupamentos e dados públicos confirmados em Q05 do vault.
// Não importar respostas privadas ou tratar cada fotografia como uma obra.
export const obrasConfirmadas: readonly ObraConfirmada[] = [];

export function fotosDaObra(obra: ObraConfirmada) {
  if (!obra.fotoIds.length || !obra.fotoIds.includes(obra.capaFotoId)) {
    throw new Error("A capa deve pertencer à galeria confirmada: " + obra.id);
  }
  return obra.fotoIds.map(fotoPorId);
}

export const fotosSemObra = fotosAcervo.filter(foto =>
  !obrasConfirmadas.some(obra => obra.fotoIds.includes(foto.id))
);
