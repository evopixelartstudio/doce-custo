import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#C86D7F",
};

export const metadata: Metadata = {
  title: "DoceCusto — Gestão de Receitas e Precificação",
  description: "Sistema profissional para confeitaria: ingredientes, fichas técnicas, custos de produção e cálculo preciso de preços de venda.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DoceCusto",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-[#FDFBF9] text-[#2E2226]">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
