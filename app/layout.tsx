import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { WhatsappFlutuante } from "@/components/whatsapp-flutuante";
import { cn } from "@/lib/utils";
import { SITE_URL, siteConfig } from "@/lib/site-config";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Don Energy — Energia Solar em Mococa e Região",
  alternates: { canonical: "/" },
  twitter: { card: "summary_large_image", title: "Don Energy — Energia Solar em Mococa e Região", description: siteConfig.descricao, images: [siteConfig.imagemSocial.src] },
  description:
    "Soluções em energia solar para residências, comércios, propriedades rurais e usinas de investimento em Mococa-SP e região.",
  openGraph: {
    url: "/",
    title: "Don Energy — Energia Solar em Mococa e Região",
    description:
      "Soluções em energia solar para residências, comércios, propriedades rurais e usinas de investimento em Mococa-SP e região.",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Don Energy — Energia Solar",
      },
    ],
  },
};

// viewportFit: "cover" é o que permite env(safe-area-inset-bottom) resolver
// pra um valor real em iPhones com barra de gestos — usado pelo botão
// flutuante do WhatsApp (components/whatsapp-flutuante.tsx). Sem isso, o
// env() sempre resolve pra 0 silenciosamente, sem erro nenhum.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={cn("h-full", "antialiased", sora.variable, inter.variable, "font-sans")}
    >
      <body className="min-h-full flex flex-col wrap-anywhere">
        <a href="#conteudo" className="sr-only fixed top-2 left-2 z-[100] rounded-md bg-white px-4 py-3 text-brand-blue focus:not-sr-only">Pular para o conteúdo</a>
        <Header />
        {children}
        <Footer />
        <WhatsappFlutuante />
      </body>
    </html>
  );
}