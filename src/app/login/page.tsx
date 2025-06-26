// app/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'; // Importe signOut também para o logout
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/app/context/AuthContext';
import styles from './login.module.scss';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { currentUser, loading } = useAuth();

  useEffect(() => {
    if (!loading && currentUser) {
      // Se o usuário está logado, defina um cookie de sessão simples
      document.cookie = 'user_logged_in=true; path=/; max-age=' + (60 * 60 * 24 * 7); // Cookie válido por 7 dias
      // REDIRECIONAR PARA O DASHBOARD DO ADMIN
      router.push('/admin/dashboard');
    }
  }, [currentUser, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // O useEffect acima lidará com o redirecionamento e a configuração do cookie
    } catch (err: any) {
      console.error("Erro ao fazer login:", err);
      if (err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/user-not-found') {
        setError('Usuário não encontrado.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Senha incorreta.');
      } else {
        setError(`Erro ao fazer login: ${err.message}`);
      }
    }
  };

  // Lógica para lidar com logout (se você tiver um botão de logout em algum lugar)
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Remova o cookie ao fazer logout
      document.cookie = 'user_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
      router.push('/login'); // Redireciona para a página de login após o logout
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };


  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <p>Verificando sessão...</p>
      </div>
    );
  }

  // Se o usuário já estiver logado, não renderize o formulário de login aqui
  // O useEffect já lidou com o redirecionamento.
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
            <label htmlFor="password">Senha:</label>
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
            Registre-se
          </Link>
        </p>
      </div>
    </div>
  );
}
