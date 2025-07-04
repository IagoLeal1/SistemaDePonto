// app/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth'; // Importe signOut também para o logout
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/app/context/AuthContext'; // Note o caminho para o seu AuthContext
import styles from './login.module.scss';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { currentUser, loading, isAdmin } = useAuth(); // Certifique-se de que isAdmin está disponível aqui

  useEffect(() => {
    if (!loading && currentUser) {
      // Define o cookie de sessão para indicar que o utilizador está logado
      document.cookie = 'user_logged_in=true; path=/; max-age=' + (60 * 60 * 24 * 7); // Cookie válido por 7 dias

      // Define o cookie com a função do utilizador (admin ou employee)
      // Assume que 'isAdmin' está corretamente derivado no seu AuthContext
      const userRole = isAdmin ? 'admin' : 'employee';
      document.cookie = `user_role=${userRole}; path=/; max-age=` + (60 * 60 * 24 * 7);

      // Redireciona com base na função
      if (isAdmin) {
        router.push('/admin/dashboard');
      } else {
        router.push('/ponto'); // Redireciona para /ponto se não for admin
      }
    }
  }, [currentUser, loading, isAdmin, router]); // Adicionado 'isAdmin' às dependências

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // O useEffect acima lidará com o redirecionamento e a configuração do cookie
    } catch (err: unknown) { // ✅ CORREÇÃO AQUI: 'any' para 'unknown'
      console.error("Erro ao fazer login:", err);
      let errorMessage = "Erro desconhecido ao fazer login.";
      if (err instanceof Error) {
        // Firebase Auth errors often have a 'code' property
        if ('code' in err && typeof err.code === 'string') {
          switch (err.code) {
            case 'auth/invalid-credential':
              errorMessage = 'E-mail ou palavra-passe incorretos.';
              break;
            case 'auth/user-not-found': // This might be covered by invalid-credential in newer Firebase versions
              errorMessage = 'Utilizador não encontrado.';
              break;
            case 'auth/wrong-password': // This might be covered by invalid-credential in newer Firebase versions
              errorMessage = 'Palavra-passe incorreta.';
              break;
            default:
              errorMessage = `Erro ao fazer login: ${err.message}`;
          }
        } else {
          errorMessage = `Erro ao fazer login: ${err.message}`;
        }
      } else if (typeof err === 'string') {
        errorMessage = `Erro ao fazer login: ${err}`;
      }
      setError(errorMessage);
    }
  };

  // Lógica para lidar com logout (se tiver um botão de logout em algum lugar)
  // ✅ CORREÇÃO AQUI: Se handleLogout não for usado nesta página, você pode removê-lo
  // ou movê-lo para um lugar onde ele será usado (ex: um componente de cabeçalho/sidebar).
  // Por enquanto, vou mantê-lo, mas o aviso de "never used" persistirá se não for invocado.
  // const handleLogout = async () => {
  //   try {
  //     await signOut(auth);
  //     // Remove os cookies ao fazer logout
  //     document.cookie = 'user_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
  //     document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;'; // REMOVER ESTE TAMBÉM
  //     router.push('/login'); // Redireciona para a página de login após o logout
  //   } catch (error: unknown) { // ✅ CORREÇÃO AQUI: 'any' para 'unknown'
  //     let errorMessage = "Ocorreu um erro desconhecido ao fazer logout.";
  //     if (error instanceof Error) {
  //       errorMessage = error.message;
  //     } else if (typeof error === 'string') {
  //       errorMessage = error;
  //     }
  //     console.error("Erro ao fazer logout:", errorMessage);
  //   }
  // };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <p>A verificar sessão...</p>
      </div>
    );
  }

  // Se o utilizador já estiver logado, não renderize o formulário de login aqui
  // O useEffect já lidou com o redirecionamento para a página correta.
  if (currentUser) {
    return null;
  }

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <h1 className={styles.title}>Ponto Digital</h1>

        <form onSubmit={handleLogin} className={styles.loginForm}>
          <div className={styles.formGroup}>
            <label htmlFor="email">E-mail:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="password">Palavra-passe:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className={styles.loginButton}>Entrar</button>
        </form>

        <p className={styles.registerPrompt}>
          Não tem uma conta?{' '}
          <Link href="/register" className={styles.registerLink}>
            Registe-se
          </Link>
        </p>
      </div>
    </div>
  );
}