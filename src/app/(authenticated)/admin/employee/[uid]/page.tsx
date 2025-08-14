// app/admin/employee/[uid]/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, limit, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/src/app/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import PunchHistoryTable from '@/components/PunchHistoryTable';
import styles from './employeeHistory.module.scss';
import { FaFilePdf, FaSpinner } from 'react-icons/fa';

import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toDate, toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// --- Interfaces ---
interface BatidaDePonto {
  id: string;
  userId: string;
  timestamp: Date;
  type: 'entrada' | 'inicio_almoco' | 'fim_almoco' | 'saida';
  timestamp_date?: string;
  timestamp_time?: string;
}

interface FirestoreEmployeeData {
  name: string;
  email: string;
  role: 'admin' | 'employee' | string;
}

interface Employee {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
}

interface DailyPunches {
  date: string;
  records: BatidaDePonto[];
  dailyTotal: string;
}

const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

// --- Componente Principal ---
export default function EmployeeHistoryPage() {
  const { currentUser, loading, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const employeeUid = params.uid as string;
  const reportContentRef = useRef<HTMLDivElement>(null);

  const [employeeInfo, setEmployeeInfo] = useState<Employee | null>(null);
  const [punchRecords, setPunchRecords] = useState<BatidaDePonto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const [startDate, setStartDate] = useState<string>(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  );

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editedRecordData, setEditedRecordData] = useState<Partial<BatidaDePonto> & { timestamp_date?: string, timestamp_time?: string } | null>(null);

  const formatMillisToHours = (millis: number): string => {
    if (isNaN(millis) || millis < 0) millis = 0;
    const hours = Math.floor(millis / 3600000);
    const minutes = Math.floor((millis % 3600000) / 60000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const { dailyData, grandTotal } = useMemo(() => {
    if (punchRecords.length === 0) {
      return { dailyData: [], grandTotal: '00:00' };
    }
    const groupedByDay = punchRecords.reduce((acc, record) => {
      const zonedDate = toZonedTime(record.timestamp, BRAZIL_TIMEZONE);
      const dayKey = format(zonedDate, 'yyyy-MM-dd');
      if (!acc[dayKey]) acc[dayKey] = [];
      acc[dayKey].push(record);
      return acc;
    }, {} as Record<string, BatidaDePonto[]>);

    let totalMillis = 0;
    const calculatedData: DailyPunches[] = Object.keys(groupedByDay).map(dayKey => {
      const records = groupedByDay[dayKey];
      let entrada: Date | undefined, saida: Date | undefined;
      let inicioAlmoco: Date | undefined, fimAlmoco: Date | undefined;

      records.forEach(r => {
        if (r.type === 'entrada') entrada = r.timestamp;
        if (r.type === 'saida') saida = r.timestamp;
        if (r.type === 'inicio_almoco') inicioAlmoco = r.timestamp;
        if (r.type === 'fim_almoco') fimAlmoco = r.timestamp;
      });

      let workMillis = 0;
      if (entrada && saida) { workMillis = saida.getTime() - entrada.getTime(); }
      let breakMillis = 0;
      if (inicioAlmoco && fimAlmoco) { breakMillis = fimAlmoco.getTime() - inicioAlmoco.getTime(); }

      const dailyTotalMillis = workMillis - breakMillis;
      totalMillis += dailyTotalMillis > 0 ? dailyTotalMillis : 0;
      const displayDate = format(toZonedTime(records[0].timestamp, BRAZIL_TIMEZONE), 'dd/MM/yyyy (EEEE)', { locale: ptBR });
      return { date: displayDate, records, dailyTotal: formatMillisToHours(dailyTotalMillis) };
    });
    
    calculatedData.sort((a, b) => new Date(b.records[0].timestamp).getTime() - new Date(a.records[0].timestamp).getTime());
    return { dailyData: calculatedData, grandTotal: formatMillisToHours(totalMillis) };
  }, [punchRecords]);

  const fetchEmployeeInfo = useCallback(async (uid: string) => {
    try {
      const q = query(collection(db, 'users'), where('uid', '==', uid), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data() as FirestoreEmployeeData;
        setEmployeeInfo({ uid: querySnapshot.docs[0].id, name: data.name, email: data.email, role: data.role as 'admin' | 'employee' });
      } else { setError("Funcionário não encontrado."); }
    } catch (err) {
      console.error("Erro ao buscar informações do funcionário:", err);
      setError("Erro ao carregar informações do funcionário.");
    }
  }, []);
  
  const fetchPunchRecords = useCallback(async (uid: string) => {
    if (!uid) return;
    try {
      setError(null);
      setPageLoading(true);
      let recordsQuery = query(collection(db, 'batidasDePonto'), where('userId', '==', uid));
      if (startDate) {
        const startOfDayUTC = toDate(`${startDate}T00:00:00`, { timeZone: BRAZIL_TIMEZONE });
        recordsQuery = query(recordsQuery, where('timestamp', '>=', Timestamp.fromDate(startOfDayUTC)));
      }
      if (endDate) {
        const endOfDayUTC = toDate(`${endDate}T23:59:59`, { timeZone: BRAZIL_TIMEZONE });
        recordsQuery = query(recordsQuery, where('timestamp', '<=', Timestamp.fromDate(endOfDayUTC)));
      }
      recordsQuery = query(recordsQuery, orderBy('timestamp', 'asc'));
      const querySnapshot = await getDocs(recordsQuery);
      const recordsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        userId: doc.data().userId,
        timestamp: (doc.data().timestamp as Timestamp).toDate(),
        type: doc.data().type,
      } as BatidaDePonto));
      setPunchRecords(recordsList);
    } catch (err) {
      console.error("Erro ao buscar registros de ponto:", err);
      setError("Erro ao carregar registros de ponto.");
    } finally {
      setPageLoading(false);
    }
  }, [startDate, endDate]);

  const handleApplyFilter = () => {
    fetchPunchRecords(employeeUid);
  };
  
  const handleDownloadPdf = useCallback(async () => {
    if (!reportContentRef.current || !employeeInfo) {
      setError("Conteúdo do relatório indisponível."); return;
    }
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(reportContentRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4', true);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = pdfHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
      while (heightLeft > 0) {
        position = -pdf.internal.pageSize.getHeight() * (pdf.internal.pages.length - 1);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }
      const filename = `Relatorio_Ponto_${employeeInfo.name.replace(/\s/g, '_')}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      setError("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setIsDownloading(false);
    }
  }, [employeeInfo]);
  
  const handleEditClick = useCallback((record: BatidaDePonto) => {
    setEditingRecordId(record.id);
    const zonedDate = toZonedTime(record.timestamp, BRAZIL_TIMEZONE);
    setEditedRecordData({ ...record, timestamp_date: format(zonedDate, 'yyyy-MM-dd'), timestamp_time: format(zonedDate, 'HH:mm:ss') });
  }, []);
  
  const handleCancelEdit = useCallback(() => {
    setEditingRecordId(null);
    setEditedRecordData(null);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, field: string) => {
    setEditedRecordData(prev => ({ ...prev!, [field]: e.target.value }));
  }, []);
  
  const handleSaveClick = useCallback(async (recordId: string) => {
    if (!editedRecordData?.type || !editedRecordData.timestamp_date || !editedRecordData.timestamp_time) {
      return setError("Dados de edição inválidos.");
    }
    setError(null);
    try {
      const localDateTimeString = `${editedRecordData.timestamp_date}T${editedRecordData.timestamp_time}`;
      const newTimestampUTC = toDate(localDateTimeString, { timeZone: BRAZIL_TIMEZONE });
      if (isNaN(newTimestampUTC.getTime())) throw new Error("Data ou hora inválida.");
      
      const recordRef = doc(db, 'batidasDePonto', recordId);
      await updateDoc(recordRef, { timestamp: Timestamp.fromDate(newTimestampUTC), type: editedRecordData.type });

      setPunchRecords(prevRecords => {
        const updatedRecords = prevRecords.map(rec => rec.id === recordId ? { ...rec, timestamp: newTimestampUTC, type: editedRecordData.type as BatidaDePonto['type'] } : rec);
        updatedRecords.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        return updatedRecords;
      });
      handleCancelEdit();
    } catch (err) {
      console.error("Erro ao salvar o registro:", err);
      setError("Falha ao salvar. Verifique os dados e tente novamente.");
    }
  }, [editedRecordData, handleCancelEdit]);

  useEffect(() => {
    if (loading) return;
    if (!currentUser || !isAdmin) {
      router.push('/login');
      return;
    }

    const loadInitialData = async () => {
  if (employeeUid) {
      setPageLoading(true);
        // Primeiro, buscamos as informações do funcionário
      await fetchEmployeeInfo(employeeUid as string);
        // Agora, chamamos a função que já usa os filtros de data
      await fetchPunchRecords(employeeUid as string);
   setPageLoading(false);
    }
 }; 
   loadInitialData();
  }, [loading, currentUser, isAdmin, employeeUid, router, fetchEmployeeInfo]);

  // --- Renderização ---
  if (loading || pageLoading) {
    return <div className={styles.loadingContainer}><p>Carregando...</p></div>;
  }
  if (error) {
    return <div className={styles.errorContainer}><p>{error}</p></div>;
  }
  
  return (
    <div className={styles.employeeHistoryContainer}>
      <div className={styles.employeeTitle}>
        <h2 className={styles.title}>Histórico de Ponto de {employeeInfo?.name || 'Funcionário'}</h2>
        <p className={styles.subtitle}>Email: {employeeInfo?.email}</p>
          <button onClick={handleDownloadPdf} className={styles.downloadReportButton} disabled={isDownloading || dailyData.length === 0}>
          {isDownloading ? <FaSpinner className={styles.spinnerIcon} /> : <FaFilePdf className={styles.buttonIcon} />}
          {isDownloading ? 'Gerando PDF...' : 'Baixar Relatório'}
        </button>
      </div>
      
      <div className={styles.filterAndDownloadSection}>
        <div className={styles.filterContainer}>
          <label htmlFor="startDate">De:</label>
          <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className={styles.dateInput} />
          <label htmlFor="endDate">Até:</label>
          <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className={styles.dateInput} />
          <button onClick={handleApplyFilter} className={styles.applyFilterButton}>Aplicar Filtro</button>
        </div>
      </div>
      
      {dailyData.length === 0 ? (
        <p className={styles.noRecordsMessage}>Nenhum registro de ponto encontrado.</p>
      ) : (
        <div className={styles.reportContent} ref={reportContentRef}>
          <div className={styles.grandTotalContainer}>
            <h3>Total de Horas no Período: <span>{grandTotal}</span></h3>
          </div>

          {dailyData.map((dayGroup) => (
            <div key={dayGroup.date} className={styles.dailyGroup}>
              <PunchHistoryTable
                records={dayGroup.records}
                dailyTotal={dayGroup.dailyTotal}
                editingRecordId={editingRecordId}
                editedRecordData={editedRecordData}
                onEdit={handleEditClick}
                onSave={handleSaveClick}
                onCancel={handleCancelEdit}
                onInputChange={handleInputChange}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}