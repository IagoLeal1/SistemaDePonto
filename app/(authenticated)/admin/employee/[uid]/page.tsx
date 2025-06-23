// app/admin/employee/[uid]/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, limit, Timestamp, doc, updateDoc } from 'firebase/firestore'; // Importe doc e updateDoc
import { useAuth } from '@/app/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import PunchHistoryTable from '@/components/PunchHistoryTable';
import styles from './employeeHistory.module.scss';
import { FaFilePdf, FaSpinner } from 'react-icons/fa';

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
  const [isDownloading, setIsDownloading] = useState(false);

  // Estados para os filtros de data
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Estados para a funcionalidade de edição
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  // Partial<BatidaDePonto> porque podemos estar editando apenas alguns campos (data, hora, tipo)
  // Além disso, adicionamos timestamp_date e timestamp_time para facilitar a manipulação no input
  const [editedRecordData, setEditedRecordData] = useState<Partial<BatidaDePonto> & { timestamp_date?: string, timestamp_time?: string } | null>(null);


  // Ref para o conteúdo que será convertido em PDF
  const reportContentRef = useRef<HTMLDivElement>(null);

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

      if (startDate) {
        const startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0);
        recordsQuery = query(recordsQuery, where('timestamp', '>=', Timestamp.fromDate(startOfDay)));
      }

      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        recordsQuery = query(recordsQuery, where('timestamp', '<=', Timestamp.fromDate(endOfDay)));
      }

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

    } catch (err: any) {
      console.error("Erro ao gerar relatório PDF:", err.message);
      setError("Erro ao gerar o relatório. Por favor, tente novamente.");
    } finally {
      setIsDownloading(false);
    }
  }, [employeeInfo, punchRecords, startDate, endDate]);

  // NOVO: Funções de manipulação de edição
  const handleEditClick = useCallback((record: BatidaDePonto) => {
    setEditingRecordId(record.id);
    // Inicializa editedRecordData com os valores atuais para edição
    setEditedRecordData({
      ...record,
      // Campos auxiliares para input date/time
      timestamp_date: record.timestamp.toISOString().split('T')[0],
      timestamp_time: record.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingRecordId(null);
    setEditedRecordData(null);
  }, []);

  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: keyof BatidaDePonto | 'timestamp_date' | 'timestamp_time' // Expanda os tipos para os campos auxiliares
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
      setPageLoading(true); // Pode usar um estado de loading mais granular se quiser     

      // Combina a data e hora dos inputs para criar um novo timestamp
      const newDateTimeString = `${editedRecordData.timestamp_date}T${editedRecordData.timestamp_time}`; // Removendo o ':00' extra
      const newTimestamp = new Date(newDateTimeString);

      if (isNaN(newTimestamp.getTime())) {
          setError("Data ou hora inválida. Por favor, verifique.");
          setPageLoading(false);
          return;
      }

      const recordRef = doc(db, 'batidasDePonto', recordId);
      await updateDoc(recordRef, {
        timestamp: newTimestamp, // Salva o novo timestamp
        type: editedRecordData.type, // Salva o novo tipo
        // userId não muda
      });

      // Atualiza a lista de registros no estado local após o salvamento
      setPunchRecords(prevRecords =>
        prevRecords.map(rec =>
          rec.id === recordId ? { ...rec, timestamp: newTimestamp, type: editedRecordData.type! } : rec
        ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) // Reordena após a atualização
      );

      handleCancelEdit(); // Sai do modo de edição
      console.log(`Registro ${recordId} atualizado com sucesso!`);
    } catch (err: any) {
      console.error("Erro ao salvar o registro:", err.message);
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