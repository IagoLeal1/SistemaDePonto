// app/(authenticated)/layout.tsx
// Antigo: components/DashboardLayout.tsx
'use client';

import Sidebar from '@/components/Sidebar'; // A Sidebar ainda vem de components
import styles from './layout.module.scss'; // AGORA IMPORTA O CSS DESTE PRÓPRIO DIRETÓRIO

interface AuthenticatedLayoutProps { // Renomeado para ser mais claro
  children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <div className={styles.authenticatedLayout}> {/* NOME DA CLASSE MUDOU */}
      <Sidebar />
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}