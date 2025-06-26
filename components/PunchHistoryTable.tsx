// components/PunchHistoryTable.tsx
'use client';

import React from 'react';
import styles from './PunchHistoryTable.module.scss';
import { FaCalendarAlt, FaSignInAlt, FaSignOutAlt, FaUtensils } from 'react-icons/fa'; // Import icons

// Importar date-fns para formatação e date-fns-tz para fuso horário
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale'; // Para nomes de dias/meses em português

interface BatidaDePonto {
  id: string;
  userId: string;
  timestamp: Date;
  type: 'entrada' | 'inicio_almoco' | 'fim_almoco' | 'saida';
}

interface PunchHistoryTableProps {
  records: BatidaDePonto[];
  editingRecordId: string | null;
  editedRecordData: Partial<BatidaDePonto> & { timestamp_date?: string, timestamp_time?: string } | null;
  onEdit: (record: BatidaDePonto) => void;
  onSave: (recordId: string) => void;
  onCancel: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, field: keyof BatidaDePonto | 'timestamp_date' | 'timestamp_time') => void;
}

// Defina o fuso horário padrão do Brasil para consistência
const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

export default function PunchHistoryTable({
  records,
  editingRecordId,
  editedRecordData,
  onEdit,
  onSave,
  onCancel,
  onInputChange,
}: PunchHistoryTableProps) {

  const getTypeName = (type: BatidaDePonto['type']) => {
    switch (type) {
      case 'entrada': return 'Entrada';
      case 'inicio_almoco': return 'Início Almoço';
      case 'fim_almoco': return 'Fim Almoço';
      case 'saida': return 'Saída';
      default: return type;
    }
  };

  const getTypeIcon = (type: BatidaDePonto['type']) => {
    switch (type) {
      case 'entrada': return <FaSignInAlt className={styles.iconIn} />;
      case 'saida': return <FaSignOutAlt className={styles.iconOut} />;
      case 'inicio_almoco':
      case 'fim_almoco': return <FaUtensils className={styles.iconLunch} />;
      default: return null;
    }
  };

  // Group records by day
  const groupedRecords: { [key: string]: BatidaDePonto[] } = records.reduce((acc, record) => {
    // Para agrupar, precisamos normalizar a data para o fuso horário de exibição (Brasil)
    // Primeiro, converte o timestamp (que é UTC) para o fuso horário do Brasil
    const zonedDate = toZonedTime(record.timestamp, BRAZIL_TIMEZONE);
    // Em seguida, formata para obter a chave do dia (YYYY-MM-DD) no fuso horário do Brasil
    const dateKey = format(zonedDate, 'yyyy-MM-dd');

    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(record);
    return acc;
  }, {} as { [key: string]: BatidaDePonto[] });

  // Sort dates for display (latest date first)
  // Certifica-se que a ordenação é feita com base na data no fuso horário do Brasil
  const sortedDates = Object.keys(groupedRecords).sort((a, b) => {
    const dateA = toZonedTime(parseISO(a), BRAZIL_TIMEZONE);
    const dateB = toZonedTime(parseISO(b), BRAZIL_TIMEZONE);
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className={styles.historyTableContainer}>
      {sortedDates.length === 0 ? (
        <p className={styles.noRecordsMessage}>Nenhum registro de ponto encontrado.</p>
      ) : (
        sortedDates.map(dateKey => (
          <div key={dateKey} className={styles.dayGroup}>
            <h3 className={styles.dayHeader}>
              <FaCalendarAlt className={styles.calendarIcon} />
              {/* Formatação da data do cabeçalho do dia */}
              {format(toZonedTime(parseISO(dateKey), BRAZIL_TIMEZONE), 'EEEE, dd \'de\' MMMM \'de\' yyyy', { locale: ptBR })}
            </h3>
            <ul className={styles.punchList}>
              {groupedRecords[dateKey]
                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) // Sort punches within the day
                .map(record => {
                  const isEditing = editingRecordId === record.id;
                  const currentRecord = isEditing && editedRecordData ? editedRecordData : record;

                  // Converte o timestamp para o fuso horário local (Brasil) para exibição nos inputs e no modo de visualização
                  const zonedTimestamp = toZonedTime(record.timestamp, BRAZIL_TIMEZONE);

                  const dateValue = isEditing
                    ? (currentRecord.timestamp_date || '') // Se estiver editando, usa o estado de edição
                    : format(zonedTimestamp, 'yyyy-MM-dd'); // Caso contrário, formata a data do timestamp original

                  const timeValue = isEditing
                    ? (currentRecord.timestamp_time || '') // Se estiver editando, usa o estado de edição
                    : format(zonedTimestamp, 'HH:mm:ss'); // Caso contrário, formata a hora do timestamp original


                  return (
                    <li
                      key={record.id}
                      className={`${styles.punchItem} ${isEditing ? styles.editing : ''}`}
                      onClick={() => !isEditing && onEdit(record)} // Inicia a edição ao clicar, se não estiver editando
                    >
                      {isEditing ? (
                        <div className={styles.editForm}>
                          <select
                            value={currentRecord.type}
                            onChange={(e) => onInputChange(e, 'type')}
                            className={styles.editSelect}
                          >
                            <option value="entrada">Entrada</option>
                            <option value="inicio_almoco">Início Almoço</option>
                            <option value="fim_almoco">Fim Almoço</option>
                            <option value="saida">Saída</option>
                          </select>
                          <input
                            type="date"
                            value={dateValue}
                            onChange={(e) => onInputChange(e, 'timestamp_date')}
                            className={styles.editInput}
                          />
                          <input
                            type="time"
                            value={timeValue}
                            onChange={(e) => onInputChange(e, 'timestamp_time')}
                            className={styles.editInput}
                          />
                          <div className={styles.editActions}>
                            <button className={styles.saveButton} onClick={(e) => { e.stopPropagation(); onSave(record.id); }}>Salvar</button>
                            <button className={styles.cancelButton} onClick={(e) => { e.stopPropagation(); onCancel(); }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        // Conteúdo normal quando não está editando
                        <div className={styles.displayContent}>
                          <div className={styles.punchDetails}>
                            <span className={styles.punchType}>
                              {getTypeIcon(record.type)}
                              {getTypeName(record.type)}
                            </span>
                            <span className={styles.punchTime}>
                              {/* Formatação da hora no modo de visualização */}
                              {format(zonedTimestamp, 'HH:mm', { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
