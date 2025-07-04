// app/admin/employee/[uid]/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, limit, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/src/app/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import PunchHistoryTable from '@/components/PunchHistoryTable';
import styles from './employeeHistory.module.scss';
import { FaFilePdf, FaSpinner } from 'react-icons/fa';

// Importar uma biblioteca de datas é altamente recomendado para evitar problemas de fuso horário
// Ex: npm install date-fns date-fns-tz
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
// Você também pode precisar de um locale para formatar nomes de dias/meses em português


interface BatidaDePonto {
  id: string;
  userId: string;
  timestamp: Date;
  type: 'entrada' | 'inicio_almoco' | 'fim_almoco' | 'saida';
  // ✅ Adicionado: Propriedades opcionais para data e hora de edição no frontend
  timestamp_date?: string;
  timestamp_time?: string;
}

// ✅ NOVO: Interface para tipar os dados que vêm do Firestore para um usuário/funcionário
interface FirestoreEmployeeData {
  name: string;
  email: string;
  role: 'admin' | 'employee' | string; // Use 'string' se 'role' puder ter outros valores no DB
  // Adicione outras propriedades que você espera do Firestore, se houver
}

interface Employee {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
}

// Defina o fuso horário padrão do Brasil para consistência
const BRAZIL_TIMEZONE = 'America/Sao_Paulo';
const BRAZIL_OFFSET_HOURS = -3; // Offset padrão do Brasil (UTC-3), pode variar com Horário de Verão

export default function EmployeeHistoryPage() {
  const { currentUser, loading, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const employeeUid = params.uid as string;

  const [employeeInfo, setEmployeeInfo] = useState<Employee | null>(null);
  const [punchRecords, setPunchRecords] = useState<BatidaDePonto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  // Estados para os filtros de data
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Estados para a funcionalidade de edição
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editedRecordData, setEditedRecordData] = useState<Partial<BatidaDePonto> & { timestamp_date?: string, timestamp_time?: string } | null>(null);

  const reportContentRef = useRef<HTMLDivElement>(null);

  console.log("Page Render: loading:", loading, "currentUser:", !!currentUser, "isAdmin:", isAdmin, "employeeUid:", employeeUid);

  const fetchEmployeeInfo = useCallback(async () => {
    console.log("fetchEmployeeInfo called for UID:", employeeUid);
    try {
      const q = query(collection(db, 'users'), where('uid', '==', employeeUid), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        // ✅ CORREÇÃO AQUI: Tipando os dados que vêm do Firestore
        const data = querySnapshot.docs[0].data() as FirestoreEmployeeData;
        setEmployeeInfo({
          uid: querySnapshot.docs[0].id,
          name: data.name,
          email: data.email,
          role: data.role as 'admin' | 'employee', // ✅ Cast seguro para o tipo de role esperado
        });
        console.log("Employee Info fetched:", data.name);
      } else {
        setError("Funcionário não encontrado.");
        console.log("Employee not found for UID:", employeeUid);
      }
    } catch (err: unknown) { // ✅ CORREÇÃO AQUI: 'any' para 'unknown'
      let errorMessage = "Ocorreu um erro desconhecido.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      console.error("Erro ao buscar informações do funcionário:", errorMessage);
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

      // Ao criar as datas de filtro, garanta que elas estão no fuso horário correto
      if (startDate) {
        const startOfDayLocal = parseISO(startDate); // YYYY-MM-DD é interpretado no fuso horário local do browser
        startOfDayLocal.setHours(0, 0, 0, 0); // Ajusta para o início do dia local

        // **WORKAROUND para toUtc:** Ajusta manualmente a data local para o fuso horário UTC do Brasil
        // Pega o offset do browser para a data e hora atual.
        const browserOffsetMinutes = startOfDayLocal.getTimezoneOffset(); // Diferença em minutos entre UTC e fuso horário local do browser
        // Converte para horas e inverte o sinal para representar o offset UTC (ex: UTC-3 seria -3)
        const browserOffsetHours = -browserOffsetMinutes / 60; 
        
        // Calcula a diferença em horas entre o fuso horário do browser e o fuso horário do Brasil
        // Se browser é UTC-5 e Brasil é UTC-3, Brasil é 2h *à frente* do browser.
        const differenceHours = BRAZIL_OFFSET_HOURS - browserOffsetHours; 
        
        // Ajusta a data local adicionando/subtraindo a diferença para 'simular' o horário no Brasil
        const startOfDayUtc = new Date(startOfDayLocal.getTime() + (differenceHours * 60 * 60 * 1000));
        
        recordsQuery = query(recordsQuery, where('timestamp', '>=', Timestamp.fromDate(startOfDayUtc)));
      }

      if (endDate) {
        const endOfDayLocal = parseISO(endDate);
        endOfDayLocal.setHours(23, 59, 59, 999);

        // **WORKAROUND para toUtc:** Ajusta manualmente a data local para o fuso horário UTC do Brasil
        const browserOffsetMinutes = endOfDayLocal.getTimezoneOffset();
        const browserOffsetHours = -browserOffsetMinutes / 60;
        const differenceHours = BRAZIL_OFFSET_HOURS - browserOffsetHours; 
        
        const endOfDayUtc = new Date(endOfDayLocal.getTime() + (differenceHours * 60 * 60 * 1000));

        recordsQuery = query(recordsQuery, where('timestamp', '<=', Timestamp.fromDate(endOfDayUtc)));
      }

      recordsQuery = query(recordsQuery, orderBy('timestamp', 'asc'));

      const querySnapshot = await getDocs(recordsQuery);
      const recordsList = querySnapshot.docs.map(doc => {
        const data = doc.data(); // ✅ 'data' será inferido como 'DocumentData' aqui.
        return {
          id: doc.id,
          userId: data.userId,
          timestamp: data.timestamp.toDate(), // Isso retorna um Date em UTC
          type: data.type,
        } as BatidaDePonto; // ✅ Cast final para BatidaDePonto, que agora inclui os campos opcionais
      });
      setPunchRecords(recordsList);
      console.log("Punch Records fetched. Count:", recordsList.length);
    } catch (err: unknown) { // ✅ CORREÇÃO AQUI: 'any' para 'unknown'
      let errorMessage = "Ocorreu um erro desconhecido.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      console.error("Erro ao buscar registros de ponto:", errorMessage);
      setError("Erro ao carregar registros de ponto.");
    }
  }, [employeeUid, startDate, endDate]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (employeeUid && currentUser && isAdmin) {
        setPageLoading(true);
        await fetchEmployeeInfo();
        await fetchPunchRecords();
        if (isMounted) {
          setPageLoading(false);
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

    return () => {
      isMounted = false;
    };
  }, [currentUser, loading, isAdmin, router, employeeUid, fetchEmployeeInfo, fetchPunchRecords]);

  const handleApplyFilter = () => {
    fetchPunchRecords();
  };

  const handleDownloadPdf = useCallback(async () => {
    if (!employeeInfo || !reportContentRef.current) {
      setError("Conteúdo do relatório não disponível para gerar o PDF.");
      return;
    }
    setIsDownloading(true);

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(reportContentRef.current, {
        scale: 2,
        useCORS: true,
        windowWidth: reportContentRef.current.scrollWidth,
        windowHeight: reportContentRef.current.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      let filename = `relatorio_ponto_${employeeInfo.name.replace(/\s/g, '_')}`;
      if (startDate && endDate) {
        filename += `_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}`;
      } else if (startDate) {
        filename += `_a_partir_de_${startDate.replace(/-/g, '')}`;
      } else if (endDate) {
        filename += `_ate_${endDate.replace(/-/g, '')}`;
      }
      filename += `.pdf`;

      pdf.save(filename);

    } catch (err: unknown) { // ✅ CORREÇÃO AQUI: 'any' para 'unknown'
      let errorMessage = "Ocorreu um erro desconhecido.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      console.error("Erro ao gerar relatório PDF:", errorMessage);
      setError("Erro ao gerar o relatório. Por favor, tente novamente.");
    } finally {
      setIsDownloading(false);
    }
  }, [employeeInfo, startDate, endDate]);

  // NOVO: Funções de manipulação de edição
  const handleEditClick = useCallback((record: BatidaDePonto) => {
    setEditingRecordId(record.id);
    // Converte o timestamp UTC do Firestore para o fuso horário local (Brasil) para exibir nos inputs
    const zonedDate = toZonedTime(record.timestamp, BRAZIL_TIMEZONE);

    setEditedRecordData({
      ...record,
      // Campos auxiliares para input date/time, formatados para o fuso horário local do Brasil
      timestamp_date: format(zonedDate, 'yyyy-MM-dd'),
      timestamp_time: format(zonedDate, 'HH:mm:ss'),
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingRecordId(null);
    setEditedRecordData(null);
  }, []);

  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: keyof BatidaDePonto | 'timestamp_date' | 'timestamp_time'
  ) => {
    if (editedRecordData) {
      setEditedRecordData(prev => ({
        ...prev!,
        [field]: e.target.value,
      }));
    }
  }, [editedRecordData]);

  const handleSaveClick = useCallback(async (recordId: string) => {
    if (!editedRecordData || !editedRecordData.type || !editedRecordData.timestamp_date || !editedRecordData.timestamp_time) {
      setError("Dados inválidos para salvar o ponto.");
      return;
    }

    try {
      setError(null);
      setPageLoading(true);

      // Combina a data e hora dos inputs (que estão no fuso horário local, YYYY-MM-DDTHH:mm:ss)
      const dateTimeStringLocal = `${editedRecordData.timestamp_date}T${editedRecordData.timestamp_time}`;
      const parsedDateLocal = parseISO(dateTimeStringLocal); // Isso cria um Date object no fuso horário local do navegador

      // **WORKAROUND para toUtc:** Converte a data/hora local para UTC, assumindo que ela representa o BRAZIL_TIMEZONE.
      // Esta lógica é necessária porque `toUtc` está a causar erro de build.
      // Ela calcula a diferença de offset entre o fuso horário do browser e o fuso horário do Brasil (UTC-3).
      // Adiciona/subtrai essa diferença para "mover" a data local para a perspectiva do fuso horário do Brasil.
      // O resultado final é um Date object em UTC que pode ser guardado no Firestore.
      
      const browserOffsetMinutes = parsedDateLocal.getTimezoneOffset(); // Ex: para UTC-3, retorna 180 (minutos de diferença para UTC)
      const browserOffsetHours = -browserOffsetMinutes / 60; // Converte para horas e inverte o sinal (ex: 3)
      
      const differenceHours = BRAZIL_OFFSET_HOURS - browserOffsetHours; // Diferença entre o offset do Brasil e o do browser
      
      // Ajusta o timestamp (em milissegundos) para refletir a hora correta no fuso horário do Brasil,
      // antes de ser naturalmente convertida para UTC quando o Date object é finalizado.
      const newTimestampUtc = new Date(parsedDateLocal.getTime() + (differenceHours * 60 * 60 * 1000));

      if (isNaN(newTimestampUtc.getTime())) {
        setError("Data ou hora inválida. Por favor, verifique.");
        setPageLoading(false);
        return;
      }

      const recordRef = doc(db, 'batidasDePonto', recordId);
      await updateDoc(recordRef, {
        timestamp: newTimestampUtc, // Salva o novo timestamp (em UTC)
        type: editedRecordData.type,
      });

      // Atualiza a lista de registros no estado local após o salvamento
      setPunchRecords(prevRecords =>
        prevRecords.map(rec =>
          rec.id === recordId ? { ...rec, timestamp: newTimestampUtc } : rec // Use o timestamp UTC aqui
        ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      );

      handleCancelEdit(); // Sai do modo de edição
      console.log(`Registro ${recordId} atualizado com sucesso!`);
    } catch (err: unknown) { // ✅ CORREÇÃO AQUI: 'any' para 'unknown'
      let errorMessage = "Ocorreu um erro desconhecido.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      console.error("Erro ao salvar o registro:", errorMessage);
      setError("Erro ao salvar o registro. Verifique o formato da data/hora ou tente novamente.");
    } finally {
      setPageLoading(false);
    }
  }, [editedRecordData, handleCancelEdit]);

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

      {/* Seção de Filtro de Data e Botão de Download */}
      <div className={styles.filterAndDownloadSection}>
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

        {/* Botão de Download PDF */}
        <button
          onClick={handleDownloadPdf}
          className={styles.downloadReportButton}
          disabled={isDownloading || punchRecords.length === 0}
          title="Baixar relatório de ponto em PDF"
        >
          {isDownloading ? (
            <FaSpinner className={styles.spinnerIcon} />
          ) : (
            <FaFilePdf className={styles.buttonIcon} />
          )}
          {isDownloading ? 'Gerando PDF...' : 'Baixar Relatório PDF'}
        </button>
      </div>

      {punchRecords.length === 0 ? (
        <p className={styles.noRecordsMessage}>Nenhum registro de ponto encontrado para este funcionário{startDate || endDate ? ' no período selecionado.' : '.'}</p>
      ) : (
        // Conteúdo do relatório que será capturado pelo html2canvas
        <div className={styles.reportContent} ref={reportContentRef}>
          <h3 className={styles.reportHeaderTitle}>Relatório de Ponto de {employeeInfo?.name}</h3>
          {startDate || endDate ? (
            <p className={styles.reportPeriod}>Período: {startDate ? new Date(startDate).toLocaleDateString('pt-BR') : 'Início'} a {endDate ? new Date(endDate).toLocaleDateString('pt-BR') : 'Fim'}</p>
          ) : (
            <p className={styles.reportPeriod}>Período: Todos os registros</p>
          )}
          <PunchHistoryTable
            records={punchRecords}
            editingRecordId={editingRecordId}
            editedRecordData={editedRecordData}
            onEdit={handleEditClick}
            onSave={handleSaveClick}
            onCancel={handleCancelEdit}
            onInputChange={handleInputChange}
          />
        </div>
      )}
    </div>
  );
}