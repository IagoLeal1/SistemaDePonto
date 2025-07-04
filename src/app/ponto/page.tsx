// app/ponto/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/src/app/context/AuthContext';
// ✅ CORREÇÃO AQUI: Garanta que 'auth' está importado de '@/lib/firebase'
import { auth, db } from '@/lib/firebase'; 
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import styles from './ponto.module.scss';

// Importar ícones
import { FaSignInAlt, FaSignOutAlt, FaUtensils, FaDoorOpen, FaClock } from 'react-icons/fa';
// ✅ CORREÇÃO AQUI: Mantenha apenas 'signOut' se 'auth' já vem de '@/lib/firebase'
import { signOut } from 'firebase/auth'; 

// Importar date-fns para formatação e date-fns-tz para fuso horário
import { format, startOfDay, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

// Tipos de batida de ponto
type BatidaType = 'entrada' | 'inicio_almoco' | 'fim_almoco' | 'saida';

// Interface para um registro de batida no Firestore
interface BatidaDePonto {
  id: string;
  userId: string;
  timestamp: Date;
  type: BatidaType;
}

// Defina o fuso horário padrão do Brasil para consistência
const BRAZIL_TIMEZONE = 'America/Sao_Paulo';
const BRAZIL_OFFSET_HOURS = -3; 


export default function PontoPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [lastBatida, setLastBatida] = useState<BatidaDePonto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPunching, setIsPunching] = useState(false);
  const [hasEnteredToday, setHasEnteredToday] = useState(false);

  // Mapeamento da próxima batida esperada
  const nextExpectedPunch: Record<BatidaType | 'nenhuma', BatidaType> = {
    'nenhuma': 'entrada',
    'entrada': 'inicio_almoco',
    'inicio_almoco': 'fim_almoco',
    'fim_almoco': 'saida',
    'saida': 'entrada',
  };

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
        const docData = querySnapshot.docs[0].data(); // Pega os dados do documento
        setLastBatida({
          id: querySnapshot.docs[0].id,
          userId: docData.userId,
          timestamp: docData.timestamp.toDate(),
          type: docData.type,
        } as BatidaDePonto);
      } else {
        setLastBatida(null);
      }
    } catch (err: unknown) {
      let errorMessage = "Ocorreu um erro desconhecido.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      console.error("Erro ao buscar última batida:", errorMessage);
      setError("Erro ao carregar seu status de ponto.");
    }
  }, [currentUser]);

  const checkIfEnteredToday = useCallback(async () => {
    if (!currentUser?.uid) {
      setHasEnteredToday(false);
      return;
    }

    try {
      const now = new Date();
      // ✅ CORREÇÃO AQUI: Garanta que as variáveis são declaradas antes de serem usadas nos cálculos de offset.
      // E que as chamadas a date-fns estejam corretas.
      const startOfTodayZoned = toZonedTime(now, BRAZIL_TIMEZONE);
      const startOfTodayLocal = startOfDay(startOfTodayZoned); // Início do dia no fuso horário do Brasil

      const endOfTodayZoned = toZonedTime(now, BRAZIL_TIMEZONE);
      const endOfTodayLocal = endOfDay(endOfTodayZoned); // Fim do dia no fuso horário do Brasil

      // Converte as datas locais para UTC para a query do Firestore
      const browserOffsetMinutesStart = startOfTodayLocal.getTimezoneOffset();
      const browserOffsetHoursStart = -browserOffsetMinutesStart / 60;
      const differenceHoursStart = BRAZIL_OFFSET_HOURS - browserOffsetHoursStart; 
      const startOfTodayUtc = new Date(startOfTodayLocal.getTime() + (differenceHoursStart * 60 * 60 * 1000));

      const browserOffsetMinutesEnd = endOfTodayLocal.getTimezoneOffset();
      const browserOffsetHoursEnd = -browserOffsetMinutesEnd / 60;
      const differenceHoursEnd = BRAZIL_OFFSET_HOURS - browserOffsetHoursEnd; 
      const endOfTodayUtc = new Date(endOfTodayLocal.getTime() + (differenceHoursEnd * 60 * 60 * 1000));

      const q = query(
        collection(db, 'batidasDePonto'),
        where('userId', '==', currentUser.uid),
        where('type', '==', 'entrada'),
        where('timestamp', '>=', Timestamp.fromDate(startOfTodayUtc)),
        where('timestamp', '<=', Timestamp.fromDate(endOfTodayUtc)),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      setHasEnteredToday(!querySnapshot.empty);
    } catch (err: unknown) {
      let errorMessage = "Ocorreu um erro desconhecido.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      console.error("Erro ao verificar entrada de hoje:", errorMessage);
      setHasEnteredToday(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        router.push('/login');
      } else {
        fetchLastBatida();
        checkIfEnteredToday();
      }
    }
  }, [currentUser, loading, router, fetchLastBatida, checkIfEnteredToday]);

  const handleRegistrarPonto = async (type: BatidaType) => {
    if (!currentUser) {
      setError("Você precisa estar logado para registrar o ponto.");
      return;
    }
    if (isPunching) return;

    if (type === 'entrada' && hasEnteredToday) {
      setError("Você já registrou uma entrada hoje. Não é possível registrar outra entrada no mesmo dia.");
      return;
    }

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
      if (type === 'entrada') {
        setHasEnteredToday(true);
      }
      checkIfEnteredToday();
    } catch (err: unknown) {
      let errorMessage = "Ocorreu um erro desconhecido.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      console.error(`Erro ao registrar ponto de ${type}:`, errorMessage);
      setError(`Erro ao registrar ponto de ${type}. Por favor, tente novamente.`);
    } finally {
      setIsPunching(false);
    }
  };

  const handleLogout = async () => {
    try {
      // ✅ CORREÇÃO AQUI: Use 'auth' diretamente, que já foi importado do '@/lib/firebase'
      await signOut(auth); 
      document.cookie = 'user_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
      document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
      router.push('/login');
    } catch (err: unknown) {
      let errorMessage = "Ocorreu um erro desconhecido.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      console.error("Erro ao fazer logout:", errorMessage);
      setError("Erro ao fazer logout. Por favor, tente novamente.");
    }
  };

  if (loading || !currentUser) {
    return (
      <div className={styles.loadingContainer}>
        <p>Carregando ou verificando autenticação...</p>
      </div>
    );
  }

  const currentExpectedType = lastBatida ? nextExpectedPunch[lastBatida.type] : nextExpectedPunch['nenhuma'];

  const renderPontoButton = (type: BatidaType, icon: React.ReactNode, label: string) => {
    const isButtonEnabled = currentExpectedType === type && !(type === 'entrada' && hasEnteredToday);
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

  const lastBatidaFormattedTime = lastBatida?.timestamp
    ? format(toZonedTime(lastBatida.timestamp, BRAZIL_TIMEZONE), 'HH:mm', { locale: ptBR })
    : '';
  const lastBatidaFormattedDate = lastBatida?.timestamp
    ? format(toZonedTime(lastBatida.timestamp, BRAZIL_TIMEZONE), 'dd/MM/yyyy', { locale: ptBR })
    : '';

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
              <p>Último Registro: <strong>{lastBatida.type.replace('_', ' ')}</strong> em {lastBatidaFormattedDate} às {lastBatidaFormattedTime}</p>
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