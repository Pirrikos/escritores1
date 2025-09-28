import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";

// Inicializar sistema de backup en el servidor
if (typeof window === 'undefined') {
  // Importación dinámica para evitar problemas en el cliente
  import('@/lib/backupInitializer').catch(error => {
    console.error('Error importando inicializador de backup:', error);
  });
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Escritores - Plataforma de Escritura Creativa",
  description: "Una plataforma para escritores donde puedes crear, compartir y descubrir historias, poemas y ensayos. Únete a nuestra comunidad de escritores creativos.",
  keywords: ["escritura", "historias", "poemas", "ensayos", "escritores", "literatura", "creatividad"],
  authors: [{ name: "Escritores Platform" }],
  robots: "index, follow",
  openGraph: {
    title: "Escritores - Plataforma de Escritura Creativa",
    description: "Una plataforma para escritores donde puedes crear, compartir y descubrir historias, poemas y ensayos.",
    type: "website",
    locale: "es_ES",
  },
};

export const viewport = "width=device-width, initial-scale=1";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Skip to content link for accessibility */}
        <a 
          href="#main-content" 
          className="skip-to-content"
          tabIndex={1}
        >
          Saltar al contenido principal
        </a>
        
        <ErrorBoundary>
          <div id="root">
            <main id="main-content" tabIndex={-1}>
              {children}
            </main>
          </div>
        </ErrorBoundary>
        
        {/* Screen reader announcements */}
        <div 
          id="announcements" 
          aria-live="polite" 
          aria-atomic="true" 
          className="sr-only"
        />
      </body>
    </html>
  );
}
