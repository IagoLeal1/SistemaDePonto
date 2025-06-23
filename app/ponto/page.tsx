// app/ponto/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import styles from './ponto.module.scss';

// Importar ícones
import { FaClock, FaSignInAlt, FaSignOutAlt, FaUtensils, FaCalendarAlt, FaDoorOpen } from 'react-icons/fa';
import { getAuth, signOut } from 'firebase/auth';

// Tipos de batida de ponto
type BatidaType = 'entrada' | 'inicio_almoco' | 'fim_almoco' | 'saida';

// Interface para um registro de batida no Firestore
interface BatidaDePonto {
  id: string;
  userId: string;
  timestamp: Date;
  type: BatidaType;
}

export default function PontoPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [lastBatida, setLastBatida] = useState<BatidaDePonto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPunching, setIsPunching] = useState(false);

  // Mapeamento da próxima batida esperada
  const nextExpectedPunch: Record<BatidaType | 'nenhuma', BatidaType> = {
    'nenhuma': 'entrada',
    'entrada': 'inicio_almoco',
    'inicio_almoco': 'fim_almoco',
    'fim_almoco': 'saida',
    'saida': 'entrada',
  };

  // Função para buscar a última batida do usuário
  const fetchLastBatida = useCallback(async () => {
    if (!currentUser?.uid) return;

    try {
      setError(null);
      const q = query(
        collection(db, 'batidasDePonto'),
        where('userId', '==', currentUser.uid),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        setLastBatida({
          id: doc.id,
          userId: data.userId,
          timestamp: data.timestamp.toDate(),
          type: data.type,
        } as BatidaDePonto);
      } else {
        setLastBatida(null);
      }
    } catch (err) {
      console.error("Erro ao buscar última batida:", err);
      setError("Erro ao carregar seu status de ponto.");
    }
  }, [currentUser]);

  // Efeito para redirecionar se não estiver logado e buscar a última batida
  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        router.push('/login');
      } else {
        fetchLastBatida();
      }
    }
  }, [currentUser, loading, router, fetchLastBatida]);

  // Função para registrar o ponto
  const handleRegistrarPonto = async (type: BatidaType) => {
    if (!currentUser) {
      setError("Você precisa estar logado para registrar o ponto.");
      return;
    }
    if (isPunching) return;

    setIsPunching(true);
    setError(null);
    setMessage(null);

    const expectedType = lastBatida ? nextExpectedPunch[lastBatida.type] : nextExpectedPunch['nenhuma'];

    if (type !== expectedType) {
      setError(`Operação inválida. A próxima batida esperada é "${expectedType}".`);
      setIsPunching(false);
      return;
    }

    try {
      await addDoc(collection(db, 'batidasDePonto'), {
        userId: currentUser.uid,
        timestamp: serverTimestamp(),
        type: type,
      });
      setMessage(`Ponto de ${type.replace('_', ' ')} registrado com sucesso!`);
      await fetchLastBatida();
    } catch (err) {
      console.error(`Erro ao registrar ponto de ${type}:`, err);
      setError(`Erro ao registrar ponto de ${type}. Por favor, tente novamente.`);
    } finally {
      setIsPunching(false);
    }
  };

  // Função para logout
  const handleLogout = async () => {
    try {
      const authInstance = getAuth();
      await signOut(authInstance);
      router.push('/login');
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
      setError("Erro ao fazer logout. Por favor, tente novamente.");
    }
  };

  // Condição de carregamento/redirecionamento
  if (loading || !currentUser) {
    return (
      <div className={styles.loadingContainer}>
        <p>Carregando ou verificando autenticação...</p>
      </div>
    );
  }

  // Determina a próxima batida a ser exibida/habilitada
  const currentExpectedType = lastBatida ? nextExpectedPunch[lastBatida.type] : nextExpectedPunch['nenhuma'];

  // Função auxiliar para renderizar botões condicionalmente
  const renderPontoButton = (type: BatidaType, icon: React.ReactNode, label: string) => {
    const isButtonEnabled = currentExpectedType === type;
    return (
      <button
        key={type}
        onClick={() => handleRegistrarPonto(type)}
        className={`${styles.pontoButton} ${styles[type + 'Button']}`}
        disabled={isPunching || !isButtonEnabled}
      >
        {icon}
        {isPunching && isButtonEnabled ? 'Registrando...' : label}
      </button>
    );
  };

  return (
    <div className={styles.pontoContainer}>
      <div className={styles.mainContentWrapper}>
        <h1 className={styles.title}>Meu Ponto Eletrônico</h1>
        <p className={styles.welcomeMessage}>Olá, {currentUser.displayName || currentUser.email}!</p>

        {error && <p className={styles.errorMessage}>{error}</p>}
        {message && <p className={styles.successMessage}>{message}</p>}

        <div className={styles.lastBatidaInfo}>
          {lastBatida ? (
            <>
              <FaClock className={styles.infoIcon} />
              <p>Último Registro: <strong>{lastBatida.type.replace('_', ' ')}</strong> em {lastBatida.timestamp.toLocaleDateString('pt-BR')} às {lastBatida.timestamp.toLocaleTimeString('pt-BR')}</p>
            </>
          ) : (
            <>
              <FaClock className={styles.infoIcon} />
              <p>Nenhuma batida registrada ainda. Comece com uma Entrada!</p>
            </>
          )}
        </div>

        <div className={styles.buttonGroup}>
          {renderPontoButton('entrada', <FaSignInAlt className={styles.buttonIcon} />, 'Registrar Entrada')}
          {renderPontoButton('inicio_almoco', <FaUtensils className={styles.buttonIcon} />, 'Início de Almoço')}
          {renderPontoButton('fim_almoco', <FaUtensils className={styles.buttonIcon} />, 'Fim de Almoço')}
          {renderPontoButton('saida', <FaSignOutAlt className={styles.buttonIcon} />, 'Registrar Saída')}
        </div>

        <button onClick={handleLogout} className={styles.logoutButton} disabled={isPunching}>
          <FaDoorOpen className={styles.buttonIcon} />
          Sair
        </button>
      </div>
    </div>
  );
}