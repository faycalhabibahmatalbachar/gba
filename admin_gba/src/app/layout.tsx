import type { Metadata } from 'next';
import '@/styles/tokens.css';
import './globals.css';
import { Providers } from '@/components/providers';

/**
 * Polices 100 % locales (system stack) : aucun appel à fonts.gstatic.com au build.
 * Évite échecs Turbopack/webpack quand le réseau bloque Google Fonts.
 * Pour retrouver DM Sans / Outfit en ligne, chargez-les via @font-face locale ou CDN côté runtime.
 */
export const metadata: Metadata = {
  title: { default: 'GBA Admin', template: '%s — GBA Admin' },
  description: "Panneau d'administration GBA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className="h-full">
      <body className="h-full antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
