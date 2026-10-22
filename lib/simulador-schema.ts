import { z } from "zod";
import { estadosBrasileiros } from "@/lib/simulador-contexto";

// Valida somente a escrita de um valor declarado; não converte R$ em energia.
export function valorDeclaradoValido(value: string) {
  const texto = value.trim();
  return /^\d+(?:,\d+)?$/.test(texto) && Number.isFinite(Number(texto.replace(",", "."))) && Number(texto.replace(",", ".")) > 0;
}

export const simuladorSchema = z.object({
  perfil: z.enum(["residencial", "comercial", "rural", "usina"], "Selecione o perfil do projeto."),
  cidade: z.string().trim().min(2, "Informe a cidade.").max(100, "Use até 100 caracteres.").refine(v => /\p{L}/u.test(v), "Informe o nome da cidade."),
  uf: z.enum(estadosBrasileiros, "Selecione a UF."),
  tipoDado: z.enum(["nao-sei", "consumo", "conta"]),
  valor: z.string().trim().max(30, "Use até 30 caracteres, sem símbolos ou unidades."),
  ligacao: z.enum(["nao-sei", "monofasica", "bifasica", "trifasica"]),
}).superRefine((dados, ctx) => {
  if (dados.perfil !== "usina" && dados.tipoDado !== "nao-sei" && !valorDeclaradoValido(dados.valor)) {
    ctx.addIssue({ code: "custom", path: ["valor"], message: "Informe um valor maior que zero, usando números e vírgula decimal. Não use pontos, símbolos ou unidades." });
  }
});

export type DadosSimulador = z.infer<typeof simuladorSchema>;
