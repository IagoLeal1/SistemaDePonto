// app/register/page.tsx
'use client'; // This directive is necessary for client-side components in Next.js App Router

import React, { useState } from 'react';
import { auth, db } from '@/lib/firebase'; // Import your Firebase auth and db instances
import { createUserWithEmailAndPassword } from 'firebase/auth'; // Function to create a user
import { doc, setDoc } from 'firebase/firestore'; // Functions to save data to Firestore
import { useRouter } from 'next/navigation'; // Hook for programmatic navigation
import Link from 'next/link'; // For linking to the login page

import styles from './RegisterPage.module.scss'; // Import the SCSS module for this page

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // To confirm password
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null); // Success message
  const [isLoading, setIsLoading] = useState(false); // Loading state for form submission
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Clear previous errors
    setMessage(null); // Clear previous messages
    setIsLoading(true); // Start loading

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Create the user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Save additional user information to the 'users' collection in Firestore
      // The user's UID is used as the document ID
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        name: name,
        createdAt: new Date(), // Firestore automatically converts Date objects to Timestamps
        role: 'employee', // **Crucially, set the default role as 'employee' for new registrations**
      });

      setMessage('Cadastro realizado com sucesso! Redirecionando para sua área...');
      // Redirect the new employee to their default page (e.g., '/ponto')
      router.push('/ponto'); // Adjust this route to the employee's main page
    } catch (err: unknown) { // ✅ CORREÇÃO AQUI: 'any' para 'unknown'
      console.error("Erro ao registrar:", err);
      let errorMessage = "Erro desconhecido ao registrar.";

      // ✅ CORREÇÃO AQUI: Verificação de tipo para acessar propriedades do erro
      if (err instanceof Error) {
        // Firebase Auth errors often have a 'code' property
        if ('code' in err && typeof err.code === 'string') {
          switch (err.code) {
            case 'auth/email-already-in-use':
              errorMessage = 'Este e-mail já está em uso.';
              break;
            case 'auth/weak-password':
              errorMessage = 'A senha é muito fraca.';
              break;
            default:
              errorMessage = `Erro ao registrar: ${err.message}`;
          }
        } else {
          errorMessage = `Erro ao registrar: ${err.message}`;
        }
      } else if (typeof err === 'string') {
        errorMessage = `Erro ao registrar: ${err}`;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false); // Stop loading
    }
  };

  return (
    <div className={styles.registerContainer}>
      <h2 className={styles.title}>Criar Conta de Funcionário</h2>
      <form onSubmit={handleRegister} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="name">Nome Completo:</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={styles.inputField}
            disabled={isLoading}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="email">E-mail:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={styles.inputField}
            disabled={isLoading}
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
            minLength={6}
            className={styles.inputField}
            disabled={isLoading}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="confirmPassword">Confirmar Senha:</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className={styles.inputField}
            disabled={isLoading}
          />
        </div>

        {error && <p className={styles.errorMessage}>{error}</p>}
        {message && <p className={styles.successMessage}>{message}</p>}

        <button type="submit" className={styles.registerButton} disabled={isLoading}>
          {isLoading ? 'Registrando...' : 'Registrar'}
        </button>
      </form>
      <p className={styles.loginLink}>
        Já tem uma conta? <Link href="/login">Faça Login</Link>
      </p>
    </div>
  );
}