// app/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
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
      router.push('/ponto');
    }
  }, [currentUser, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
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

  if (loading) {
    return (
      <div className={styles.loadingContainer}> {/* Certifique-se de ter este estilo no seu SCSS */}
        <p>Verificando sessão...</p>
      </div>
    );
  }

  if (currentUser) {
    return null;
  }

  return (
    // O loginContainer agora será o invólucro de tela cheia que centraliza
    <div className={styles.loginContainer}>
      {/* O loginCard é a SUA BOX visível */}
      <div className={styles.loginCard}>
        <h1 className={styles.title}>Ponto Digital</h1> {/* Título dentro da box */}

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
          {error && <p className="error-message">{error}</p>} {/* Mensagem de erro global */}
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