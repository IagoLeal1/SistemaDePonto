// components/PunchHistoryTable.tsx
'use client';

import React from 'react';
import styles from './PunchHistoryTable.module.scss';
import { FaCalendarAlt, FaSignInAlt, FaSignOutAlt, FaUtensils } from 'react-icons/fa';

import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

interface BatidaDePonto {
  id: string;
  userId: string;
  timestamp: Date;
  type: 'entrada' | 'inicio_almoco' | 'fim_almoco' | 'saida';
  timestamp_date?: string;
  timestamp_time?: string;
}

// ✅ Interface de Props ATUALIZADA para receber o total diário
interface PunchHistoryTableProps {
  records: BatidaDePonto[]; // Receberá os registros de APENAS UM DIA
  dailyTotal: string;        // A nova propriedade com o total calculado
  editingRecordId: string | null;
  editedRecordData: Partial<BatidaDePonto> & { timestamp_date?: string, timestamp_time?: string } | null;
  onEdit: (record: BatidaDePonto) => void;
  onSave: (recordId: string) => void;
  onCancel: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, field: keyof BatidaDePonto | 'timestamp_date' | 'timestamp_time') => void;
}

const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

export default function PunchHistoryTable({
  records,
  dailyTotal, // Recebendo a nova prop
  editingRecordId,
  editedRecordData,
  onEdit,
  onSave,
  onCancel,
  onInputChange,
}: PunchHistoryTableProps) {

  // ✅ LÓGICA DE AGRUPAMENTO REMOVIDA
  // O componente agora é mais simples e só se preocupa em exibir os dados que recebe.

  if (!records || records.length === 0) {
    return null;
  }
  
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
  
  // A data é pega do primeiro registro do dia, pois todos os registros aqui são do mesmo dia.
  const headerDate = format(toZonedTime(records[0].timestamp, BRAZIL_TIMEZONE), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className={styles.dayGroup}>
      {/* ✅ CABEÇALHO UNIFICADO */}
      <h3 className={styles.dayHeader}>
        <div className={styles.headerDate}>
            <FaCalendarAlt className={styles.calendarIcon} />
            {headerDate.charAt(0).toUpperCase() + headerDate.slice(1)}
        </div>
        <div className={styles.headerTotal}>
            <strong>Total do Dia: {dailyTotal}</strong>
        </div>
      </h3>

      <ul className={styles.punchList}>
        {records.map(record => {
          const isEditing = editingRecordId === record.id;
          return (
            <li
              key={record.id}
              className={`${styles.punchItem} ${isEditing ? styles.editing : ''}`}
              onClick={() => !isEditing && onEdit(record)}
            >
              {isEditing ? (
                // --- Formulário de Edição ---
                <div className={styles.editForm}>
                  <select value={editedRecordData?.type} onChange={(e) => onInputChange(e, 'type')} className={styles.editSelect}>
                    <option value="entrada">Entrada</option>
                    <option value="inicio_almoco">Início Almoço</option>
                    <option value="fim_almoco">Fim Almoço</option>
                    <option value="saida">Saída</option>
                  </select>
                  <input type="date" value={editedRecordData?.timestamp_date || ''} onChange={(e) => onInputChange(e, 'timestamp_date')} className={styles.editInput} />
                  <input type="time" step="1" value={editedRecordData?.timestamp_time || ''} onChange={(e) => onInputChange(e, 'timestamp_time')} className={styles.editInput} />
                  <div className={styles.editActions}>
                    <button className={styles.saveButton} onClick={(e) => { e.stopPropagation(); onSave(record.id); }}>Salvar</button>
                    <button className={styles.cancelButton} onClick={(e) => { e.stopPropagation(); onCancel(); }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                // --- Modo de Visualização ---
                <div className={styles.displayContent}>
                  <div className={styles.punchDetails}>
                    <span className={styles.punchType}>
                      {getTypeIcon(record.type)}
                      {getTypeName(record.type)}
                    </span>
                    <span className={styles.punchTime}>
                      {format(toZonedTime(record.timestamp, BRAZIL_TIMEZONE), 'HH:mm')}
                    </span>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}