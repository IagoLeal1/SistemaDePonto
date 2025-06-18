// components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { auth } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import styles from './Sidebar.module.scss';

// Importar todos os ícones necessários
import { FaUsers, FaSignOutAlt, FaSignInAlt, FaClock, FaTachometerAlt } from 'react-icons/fa';

export default function Sidebar() {
  const { currentUser, isAdmin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brandContainer}>
        <Link href="/ponto" className={styles.brand}>
          {/* Mudei de navItemText para brandText para estilização específica do título */}
          <span className={styles.brandText}>Sistema de Ponto</span> {/* <--- MUDANÇA AQUI */}
        </Link>
      </div>
      <nav className={styles.navLinks}>
        {!isAdmin && (
          <Link
            href="/ponto"
            className={`${styles.navItem} ${pathname === '/ponto' ? styles.active : ''}`}
          >
            <FaClock className={styles.icon} />
            <span className={styles.navItemText}>Meu Ponto</span>
          </Link>
        )}

        {isAdmin && (
          <Link
            href="/admin/dashboard"
            className={`${styles.navItem} ${pathname.startsWith('/admin/dashboard') ? styles.active : ''}`}
          >
            <FaTachometerAlt className={styles.icon} />
            <span className={styles.navItemText}>Dashboard</span>
          </Link>
        )}

      </nav>
      <div className={styles.footer}>
        {currentUser ? (
          <button onClick={handleLogout} className={styles.logoutButton}>
            <FaSignOutAlt className={styles.icon} />
            <span className={styles.logoutButtonText}>Sair</span> {/* <--- MANTÉM APENAS O TEXTO "SAIR" */}
            {/* REMOVA ESTA LINHA: <span className={styles.logoutButtonEmail}>({currentUser.email})</span> */}
          </button>
        ) : (
          <Link href="/login" className={styles.navItem}>
            <FaSignInAlt className={styles.icon} />
            <span className={styles.navItemText}>Login</span>
          </Link>
        )}
      </div>
    </aside>
  );
}