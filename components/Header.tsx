// components/Header.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/src/app/context/AuthContext';
import { auth } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import styles from './Header.module.scss'; // <-- Mude o nome do arquivo de estilo
import Image from 'next/image';

// Importar todos os ícones necessários
import { FaSignOutAlt, FaSignInAlt, FaClock, FaTachometerAlt } from 'react-icons/fa';

export default function Header() {
  const { currentUser, isAdmin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      // Remove os cookies ao fazer logout
      document.cookie = 'user_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
      document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
      router.push('/login');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  // Mantemos o "loading" para evitar um piscar do conteúdo
  if (loading) {
    return null;
  }

  return (
    // 1. Mudamos de <aside> para <header> para melhor semântica HTML
    <header className={styles.header}>
      {/* 2. Agrupamos a logo e os links de navegação para alinhá-los à esquerda */}
      <div className={styles.navGroup}>
        <Link href={isAdmin ? "/admin/dashboard" : "/ponto"} className={styles.brand}>
          <Image 
            width={150} 
            height={50} 
            src="/images/logo.png" 
            alt="Logotipo da Libélula"
            className={styles.brandLogo} 
          />
        </Link>
        <nav className={styles.navLinks}>
          {!isAdmin && currentUser && (
            <Link
              href="/ponto"
              className={`${styles.navItem} ${pathname === '/ponto' ? styles.active : ''}`}
            >
              <FaClock className={styles.icon} />
              <span className={styles.navItemText}>Meu Ponto</span>
            </Link>
          )}

          {isAdmin && (
            <>
              <Link
                href="/admin/dashboard"
                className={`${styles.navItem} ${pathname.startsWith('/admin/dashboard') ? styles.active : ''}`}
              >
                <FaTachometerAlt className={styles.icon} />
                <span className={styles.navItemText}>Dashboard</span>
              </Link>
            </>
          )}
        </nav>
      </div>

      {/* 3. A seção de "usuário" fica separada para ser alinhada à direita */}
      <div className={styles.userActions}>
        {currentUser ? (
          <button onClick={handleLogout} className={styles.logoutButton}>
            <FaSignOutAlt className={styles.icon} />
            <span className={styles.logoutButtonText}>Sair</span>
          </button>
        ) : (
          <Link href="/login" className={styles.navItem}>
            <FaSignInAlt className={styles.icon} />
            <span className={styles.navItemText}>Login</span>
          </Link>
        )}
      </div>
    </header>
  );
}