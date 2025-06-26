// app/ponto/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/src/app/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore'; // Import Timestamp
import { useRouter } from 'next/navigation';
import styles from './ponto.module.scss';

// Importar ícones
import { FaClock, FaSignInAlt, FaSignOutAlt, FaUtensils, FaCalendarAlt, FaDoorOpen } from 'react-icons/fa';
import { getAuth, signOut } from 'firebase/auth';

// Importar date-fns para formatação e date-fns-tz para fuso horário
import { format, parseISO, startOfDay, endOfDay } from 'date-fns'; // Adicionado startOfDay, endOfDay
import { toZonedTime } from 'date-fns-tz'; // zonedTimeToUtc foi removido e será substituído por lógica manual
import { ptBR } from 'date-fns/locale'; // Para nomes de dias/meses em português

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
// Offset padrão do Brasil (UTC-3). Pode variar com Horário de Verão, mas para o erro de build, é um workaround.
const BRAZIL_OFFSET_HOURS = -3; 


export default function PontoPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [lastBatida, setLastBatida] = useState<BatidaDePonto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPunching, setIsPunching] = useState(false);
  const [hasEnteredToday, setHasEnteredToday] = useState(false); // NOVO ESTADO: Para verificar se já bateu entrada hoje

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
          timestamp: data.timestamp.toDate(), // Retorna um Date em UTC
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

  // NOVA FUNÇÃO: Verifica se já existe uma batida de 'entrada' para o dia atual
  const checkIfEnteredToday = useCallback(async () => {
    if (!currentUser?.uid) {
      setHasEnteredToday(false);
      return;
    }

    try {
      const now = new Date();
      // Obtém o início e fim do dia atual no fuso horário do Brasil (como objetos Date locais)
      const startOfTodayLocal = startOfDay(toZonedTime(now, BRAZIL_TIMEZONE));
      const endOfTodayLocal = endOfDay(toZonedTime(now, BRAZIL_TIMEZONE));

      // **WORKAROUND para zonedTimeToUtc:** Converte as datas locais (que representam o fuso horário do Brasil) para UTC para a query do Firestore.
      // Calcula a diferença de offset entre o fuso horário do browser e o fuso horário do Brasil (UTC-3).
      // Adiciona/subtrai essa diferença para "mover" a data local para a perspectiva do fuso horário do Brasil.
      
      const browserOffsetMinutesStart = startOfTodayLocal.getTimezoneOffset(); // Diferença em minutos entre UTC e fuso horário local do browser
      const browserOffsetHoursStart = -browserOffsetMinutesStart / 60; // Converte para horas e inverte o sinal (ex: 3)
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
        limit(1) // Só precisamos saber se existe UMA entrada para o dia
      );

      const querySnapshot = await getDocs(q);
      setHasEnteredToday(!querySnapshot.empty); // Define como true se encontrar alguma entrada
    } catch (err) {
      console.error("Erro ao verificar entrada de hoje:", err);
      setHasEnteredToday(false); // Em caso de erro, assume que não bateu
    }
  }, [currentUser]);


  // Efeito para redirecionar se não estiver logado e buscar a última batida e verificar entrada de hoje
  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        router.push('/login');
      } else {
        fetchLastBatida();
        checkIfEnteredToday(); // Chama a nova função aqui
      }
    }
  }, [currentUser, loading, router, fetchLastBatida, checkIfEnteredToday]); // Adicionado checkIfEnteredToday às dependências

  // Função para registrar o ponto
  const handleRegistrarPonto = async (type: BatidaType) => {
    if (!currentUser) {
      setError("Você precisa estar logado para registrar o ponto.");
      return;
    }
    if (isPunching) return;

    // NOVA LÓGICA: Impede múltiplas batidas de 'entrada' por dia
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
        timestamp: serverTimestamp(), // serverTimestamp() armazena em UTC
        type: type,
      });
      setMessage(`Ponto de ${type.replace('_', ' ')} registrado com sucesso!`);
      await fetchLastBatida();
      // Após uma batida de entrada bem-sucedida, atualiza o estado
      if (type === 'entrada') {
        setHasEnteredToday(true);
      }
      // Re-verifica para garantir a consistência (útil após qualquer batida)
      checkIfEnteredToday();
    } catch (err) {
      console.error(`Erro ao registrar ponto de ${type}:`, err);
      setError(`Erro ao registrar ponto de ${type}. Por favor, tente novamente.`);
    } finally {
      setIsPunching(false);
    }
  };

  // Função para logout: AGORA LIMPA OS COOKIES
  const handleLogout = async () => {
    try {
      const authInstance = getAuth();
      await signOut(authInstance);
      // Remove os cookies ao fazer logout
      document.cookie = 'user_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
      document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
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
    // Desabilita o botão 'entrada' se já houver uma entrada hoje E se for o tipo 'entrada'
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

  // Preparar a exibição da última batida com fuso horário correto
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
