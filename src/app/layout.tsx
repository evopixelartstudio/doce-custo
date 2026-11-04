import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DoceCusto — Gestão de Receitas e Precificação",
  description: "Sistema profissional para confeitaria: ingredientes, fichas técnicas, custos de produção e cálculo preciso de preços de venda.",
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
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
