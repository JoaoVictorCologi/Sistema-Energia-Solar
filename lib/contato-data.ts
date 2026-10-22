import { siteConfig } from "@/lib/site-config";

// Compatibilidade com os componentes atuais, sem duplicar os dados.
export const contato = {
  telefoneExibicao: siteConfig.telefoneExibicao,
  endereco: siteConfig.endereco,
  horarios: siteConfig.horarios,
  email: null,
  redesSociais: [],
} as const;
