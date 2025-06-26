// app/layout.tsx
// 'use client'; // <-- MANTENHA, pois AuthProvider pode ser client, ou se tiver outros hooks globais

import './styles/reset.css';    // Importe o reset.css PRIMEIRO
import './styles/globals.scss'; // Importe o globals.scss depois do reset.css
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/src/app/context/AuthContext';
// REMOVA: import Sidebar from '@/components/Sidebar';
// REMOVA: import { usePathname } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] });

// A Metadata pode ser definida aqui, pois não conflita com 'use client' diretamente
// ou em um arquivo metadata.ts
export const metadata = {
  title: 'Sistema de Ponto Eletrônico',
  description: 'Controle de ponto para funcionários',
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // REMOVA: const pathname = usePathname();
  // REMOVA: const showSidebar = pathname !== '/login';

  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>
          {children} {/* O AuthProvider envolve TUDO. O layout com a sidebar virá nos children. */}
        </AuthProvider>
      </body>
    </html>
  );
}