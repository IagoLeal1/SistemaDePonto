// components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/src/app/context/AuthContext';
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
        {/* Usamos um Link aqui para que a logo também seja clicável e leve para a dashboard ou homepage */}
        <Link href={isAdmin ? "/admin/dashboard" : "/ponto"} className={styles.brand}>
          <img src="/images/logotipo colorido e branco.png" alt="Libélula" className={styles.brandLogo} /> {/* <--- IMAGEM AQUI */}
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
          <>
            <Link
              href="/admin/dashboard"
              className={`${styles.navItem} ${pathname.startsWith('/admin/dashboard') ? styles.active : ''}`}
            >
              <FaTachometerAlt className={styles.icon} />
              <span className={styles.navItemText}>Dashboard</span>
            </Link>
            {/* Adicionei o link para 'Funcionários' se for admin */}
            
          </>
        )}

      </nav>
      <div className={styles.footer}>
        {currentUser ? (
          <button onClick={handleLogout} className={styles.logoutButton}>
            <FaSignOutAlt className={styles.icon} />
            <span className={styles.logoutButtonText}>Sair</span>
            {/* Removi a linha do e-mail conforme sua solicitação */}
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