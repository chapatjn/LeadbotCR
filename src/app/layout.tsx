import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'LeadBot CR',
  description: 'Encuentra negocios costarricenses con poca presencia web y envíales una propuesta automática.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-black/10 bg-white">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-cr-blue text-white text-sm font-bold">
                  CR
                </span>
                LeadBot CR
              </Link>
              <nav className="flex items-center gap-5 text-sm font-medium">
                <Link href="/" className="text-black/70 hover:text-black transition-colors">
                  Escáner
                </Link>
                <Link href="/leads" className="text-black/70 hover:text-black transition-colors">
                  Revisión de leads
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8">{children}</main>
          <footer className="border-t border-black/10 py-6 text-center text-xs text-black/40">
            LeadBot CR — encontrando negocios costarricenses que merecen un mejor sitio web.
          </footer>
        </div>
      </body>
    </html>
  );
}
