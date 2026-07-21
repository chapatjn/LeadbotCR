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
          <header className="relative z-30 px-4 pt-4 sm:px-6 sm:pt-5">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl border border-black/[0.07] bg-white/80 p-2 shadow-[0_8px_30px_rgba(31,22,52,0.06)] backdrop-blur-xl">
              <Link href="/" className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5">
                <span className="relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] bg-[#17131f] text-[10px] font-bold tracking-wide text-white shadow-sm">
                  <span className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-violet-500 blur-[7px] transition-transform duration-500 group-hover:scale-150" />
                  <span className="relative">CR</span>
                </span>
                <span className="leading-none">
                  <span className="block text-sm font-semibold tracking-[-0.02em] text-[#17131f]">LeadBot</span>
                  <span className="mt-1 hidden text-[9px] font-medium uppercase tracking-[0.16em] text-black/35 sm:block">Costa Rica</span>
                </span>
              </Link>

              <nav className="flex items-center rounded-xl bg-[#f1eef5] p-1 text-xs font-medium text-black/55">
                <Link
                  href="/"
                  className="rounded-lg px-3 py-2 transition hover:bg-white hover:text-black hover:shadow-sm sm:px-4"
                >
                  Escáner
                </Link>
                <Link
                  href="/leads"
                  className="rounded-lg px-3 py-2 transition hover:bg-white hover:text-black hover:shadow-sm sm:px-4"
                >
                  <span className="sm:hidden">Leads</span>
                  <span className="hidden sm:inline">Revisión de leads</span>
                </Link>
              </nav>

              <Link
                href="/leads"
                className="hidden items-center gap-2 rounded-xl bg-[#17131f] px-4 py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-[#2b2238] sm:inline-flex"
              >
                Ver prospectos
                <span aria-hidden="true" className="text-white/60">↗</span>
              </Link>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
          <footer className="border-t border-black/10 py-6 text-center text-xs text-black/40">
            LeadBot CR — encontrando negocios costarricenses que merecen un mejor sitio web.
          </footer>
        </div>
      </body>
    </html>
  );
}
