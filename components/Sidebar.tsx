// components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/src/app/context/AuthContext';
import { auth } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import styles from './Sidebar.module.scss';
import Image from 'next/image';

// Importar todos os ícones necessários
import { FaUsers, FaSignOutAlt, FaSignInAlt, FaClock, FaTachometerAlt } from 'react-icons/fa';

export default function Sidebar() {
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

  if (loading) {
    return null;
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brandContainer}>
        {/* Usamos um Link aqui para que a logo também seja clicável e leve para a dashboard ou homepage */}
        <Link href={isAdmin ? "/admin/dashboard" : "/ponto"} className={styles.brand}>
          <Image 
              width={150} 
              height={50} 
              src="/images/logo.png" 
              alt="Logotipo da Libélula" // <-- ADICIONE OU CORRIJA ESTA LINHA
              className={styles.brandLogo} 
            />{/* <--- IMAGEM AQUI */}
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
            {/* Exemplo de link para a lista de funcionários (se tiver uma) */}
            <Link
              href="/admin/employees" // Substitua por sua rota real de lista de funcionários
              className={`${styles.navItem} ${pathname.startsWith('/admin/employees') ? styles.active : ''}`}
            >
              <FaUsers className={styles.icon} />
              <span className={styles.navItemText}>Funcionários</span>
            </Link>
          </>
        )}

      </nav>
      <div className={styles.footer}>
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
    </aside>
  );
}
