// app/admin/employee/[uid]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, limit, Timestamp } from 'firebase/firestore'; // Importe Timestamp
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import PunchHistoryTable from '@/components/PunchHistoryTable';
import styles from './employeeHistory.module.scss';

interface BatidaDePonto {
  id: string;
  userId: string;
  timestamp: Date;
  type: 'entrada' | 'inicio_almoco' | 'fim_almoco' | 'saida';
}

interface Employee {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
}

export default function EmployeeHistoryPage() {
  const { currentUser, loading, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const employeeUid = params.uid as string;

  const [employeeInfo, setEmployeeInfo] = useState<Employee | null>(null);
  const [punchRecords, setPunchRecords] = useState<BatidaDePonto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Estados para os filtros de data
  const [startDate, setStartDate] = useState<string>(''); // Formato 'YYYY-MM-DD'
  const [endDate, setEndDate] = useState<string>('');   // Formato 'YYYY-MM-DD'

  console.log("Page Render: loading:", loading, "currentUser:", !!currentUser, "isAdmin:", isAdmin, "employeeUid:", employeeUid);

  const fetchEmployeeInfo = useCallback(async () => {
    console.log("fetchEmployeeInfo called for UID:", employeeUid);
    try {
      const q = query(collection(db, 'users'), where('uid', '==', employeeUid), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        setEmployeeInfo({
          uid: querySnapshot.docs[0].id,
          name: data.name,
          email: data.email,
          role: data.role,
        } as Employee);
        console.log("Employee Info fetched:", data.name);
      } else {
        setError("Funcionário não encontrado.");
        console.log("Employee not found for UID:", employeeUid);
      }
    } catch (err: any) {
      console.error("Erro ao buscar informações do funcionário:", err.message);
      setError("Erro ao carregar informações do funcionário.");
    }
  }, [employeeUid]);

  const fetchPunchRecords = useCallback(async () => {
    console.log("fetchPunchRecords called for UID:", employeeUid);
    try {
      setError(null);
      let recordsQuery = query(
        collection(db, 'batidasDePonto'),
        where('userId', '==', employeeUid)
      );

      // Adiciona filtros de data se estiverem definidos
      if (startDate) {
        // Converte a string de data para um objeto Date no início do dia
        const startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0); // Define para o início do dia
        recordsQuery = query(recordsQuery, where('timestamp', '>=', Timestamp.fromDate(startOfDay)));
      }

      if (endDate) {
        // Converte a string de data para um objeto Date no fim do dia
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999); // Define para o fim do dia
        recordsQuery = query(recordsQuery, where('timestamp', '<=', Timestamp.fromDate(endOfDay)));
      }

      // Sempre ordenar por timestamp ascendente
      recordsQuery = query(recordsQuery, orderBy('timestamp', 'asc'));

      const querySnapshot = await getDocs(recordsQuery);
      const recordsList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          timestamp: data.timestamp.toDate(),
          type: data.type,
        } as BatidaDePonto;
      });
      setPunchRecords(recordsList);
      console.log("Punch Records fetched. Count:", recordsList.length);
    } catch (err: any) {
      console.error("Erro ao buscar registros de ponto:", err.message);
      setError("Erro ao carregar registros de ponto.");
    } finally {
      // setPageLoading(false); // Esta linha deve ser descomentada no useEffect ou controlada por uma função wrapper
    }
  }, [employeeUid, startDate, endDate]); // Adicione startDate e endDate como dependências

  // Efeito para buscar dados iniciais e re-buscar ao mudar filtros
  useEffect(() => {
    let isMounted = true; // Para evitar atualização de estado em componente desmontado

    const fetchData = async () => {
      if (employeeUid && currentUser && isAdmin) {
        setPageLoading(true); // Começa a carregar
        await fetchEmployeeInfo();
        await fetchPunchRecords();
        if (isMounted) {
          setPageLoading(false); // Termina de carregar apenas quando ambas as funções retornarem
          console.log("All data fetches attempted. Setting pageLoading to false.");
        }
      }
    };

    if (!loading) {
      if (!currentUser || !isAdmin) {
        console.log("Redirecting: Not admin or not logged in.");
        router.push('/login');
      } else {
        console.log("Auth state loaded, current user is admin. Starting data fetch.");
        fetchData();
      }
    }

    return () => { // Cleanup function para o useEffect
      isMounted = false;
    };
  }, [currentUser, loading, isAdmin, router, employeeUid, fetchEmployeeInfo, fetchPunchRecords]); // fetchPunchRecords agora depende de startDate/endDate

  // Handler para aplicar o filtro
  const handleApplyFilter = () => {
    fetchPunchRecords(); // Apenas re-busca os registros com os novos filtros
  };

  if (loading || pageLoading || !currentUser || !isAdmin) {
    console.log("Displaying loading state.", {loading, pageLoading, currentUser: !!currentUser, isAdmin});
    return (
      <div className={styles.loadingContainer}>
        <p>Carregando histórico do funcionário...</p>
      </div>
    );
  }

  if (error) {
    console.log("Displaying error state:", error);
    return <div className={styles.errorContainer}><p>{error}</p></div>;
  }

  console.log("Page fully loaded. Displaying content.");
  return (
    <div className={styles.employeeHistoryContainer}>
      <h2 className={styles.title}>Histórico de Ponto de {employeeInfo?.name || 'Funcionário'}</h2>
      <p className={styles.subtitle}>Email: {employeeInfo?.email}</p>

      {/* Seção de Filtro de Data */}
      <div className={styles.filterContainer}>
        <label htmlFor="startDate">De:</label>
        <input
          type="date"
          id="startDate"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={styles.dateInput}
        />
        <label htmlFor="endDate">Até:</label>
        <input
          type="date"
          id="endDate"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className={styles.dateInput}
        />
        <button onClick={handleApplyFilter} className={styles.applyFilterButton}>
          Aplicar Filtro
        </button>
      </div>

      {punchRecords.length === 0 ? (
        <p className={styles.noRecordsMessage}>Nenhum registro de ponto encontrado para este funcionário{startDate || endDate ? ' no período selecionado.' : '.'}</p>
      ) : (
        <PunchHistoryTable records={punchRecords} />
      )}
    </div>
  );
}