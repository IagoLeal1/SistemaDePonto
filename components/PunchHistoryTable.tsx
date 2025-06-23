// components/PunchHistoryTable.tsx
'use client';

import React from 'react';
import styles from './PunchHistoryTable.module.scss';
import { FaCalendarAlt, FaSignInAlt, FaSignOutAlt, FaUtensils } from 'react-icons/fa'; // Import icons

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
  onEdit: (record: BatidaDePonto) => void; // Esta função será chamada ao clicar no item
  onSave: (recordId: string) => void;
  onCancel: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, field: keyof BatidaDePonto | 'timestamp_date' | 'timestamp_time') => void;
}

export default function PunchHistoryTable({
  records,
  editingRecordId,
  editedRecordData,
  onEdit, // Recebemos onEdit aqui
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
    const dateKey = record.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(record);
    return acc;
  }, {} as { [key: string]: BatidaDePonto[] });

  // Sort dates for display (latest date first)
  const sortedDates = Object.keys(groupedRecords).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <div className={styles.historyTableContainer}>
      {sortedDates.length === 0 ? (
        <p className={styles.noRecordsMessage}>Nenhum registro de ponto encontrado.</p>
      ) : (
        sortedDates.map(dateKey => (
          <div key={dateKey} className={styles.dayGroup}>
            <h3 className={styles.dayHeader}>
              <FaCalendarAlt className={styles.calendarIcon} />
              {new Date(dateKey).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h3>
            <ul className={styles.punchList}>
              {groupedRecords[dateKey]
                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) // Sort punches within the day
                .map(record => {
                  const isEditing = editingRecordId === record.id;
                  const currentRecord = isEditing && editedRecordData ? editedRecordData : record;

                  const dateValue = currentRecord.timestamp instanceof Date
                    ? currentRecord.timestamp.toISOString().split('T')[0]
                    : (currentRecord.timestamp_date || '');
                  const timeValue = currentRecord.timestamp instanceof Date
                    ? currentRecord.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                    : (currentRecord.timestamp_time || '');

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
                        <div className={styles.displayContent}> {/* Novo wrapper para o conteúdo visualizável */}
                          <div className={styles.punchDetails}>
                            <span className={styles.punchType}>
                              {getTypeIcon(record.type)}
                              {getTypeName(record.type)}
                            </span>
                            <span className={styles.punchTime}>
                              {record.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {/* O botão de edição foi removido daqui */}
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