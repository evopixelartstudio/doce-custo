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
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              nextjs-portal,
              #__next-build-watcher,
              [data-nextjs-toast],
              [data-nextjs-dev-tools-button],
              [data-nextjs-dev-tools] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                position: fixed !important;
                top: -9999px !important;
                left: -9999px !important;
                width: 0 !important;
                height: 0 !important;
                z-index: -9999 !important;
              }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function removeNextDevTools() {
                  var els = document.querySelectorAll('nextjs-portal, [data-nextjs-dev-tools-button]');
                  for (var i = 0; i < els.length; i++) {
                    els[i].remove();
                  }
                }
                if (typeof window !== 'undefined') {
                  removeNextDevTools();
                  var obs = new MutationObserver(removeNextDevTools);
                  if (document.documentElement) {
                    obs.observe(document.documentElement, { childList: true, subtree: true });
                  }
                  window.addEventListener('DOMContentLoaded', removeNextDevTools);
                  window.addEventListener('load', removeNextDevTools);
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-[#FDFBF9] text-[#2E2226]">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
