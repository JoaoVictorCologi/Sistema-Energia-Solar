import { siteConfig } from "@/lib/site-config";

const DEFAULT_MESSAGE =
  "Olá! Vim pelo site da Don Energy e gostaria de saber mais sobre os serviços de energia solar.";

export function buildWhatsAppUrl(message: string = DEFAULT_MESSAGE) {
  return `https://wa.me/${siteConfig.whatsapp}?text=${encodeURIComponent(message)}`;
}
