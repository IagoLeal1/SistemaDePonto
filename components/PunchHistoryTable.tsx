// components/PunchHistoryTable.tsx
'use client';

import React from 'react';
import styles from './PunchHistoryTable.module.scss';
import { FaSignInAlt, FaSignOutAlt, FaUtensils, FaClock, FaCalendarAlt  } from 'react-icons/fa'; // Ícones para os tipos de batida

interface BatidaDePonto {
  id: string;
  userId: string;
  timestamp: Date;
  type: 'entrada' | 'inicio_almoco' | 'fim_almoco' | 'saida';
}

interface PunchHistoryTableProps {
  records: BatidaDePonto[];
}

// Mapeamento de tipos para exibir de forma amigável e com ícones
const punchTypeMap = {
  'entrada': { label: 'Entrada', icon: <FaSignInAlt className={styles.iconIn} /> },
  'inicio_almoco': { label: 'Início Almoço', icon: <FaUtensils className={styles.iconLunch} /> },
  'fim_almoco': { label: 'Fim Almoço', icon: <FaUtensils className={styles.iconLunch} /> },
  'saida': { label: 'Saída', icon: <FaSignOutAlt className={styles.iconOut} /> },
};

export default function PunchHistoryTable({ records }: PunchHistoryTableProps) {
  // Organizar registros por dia
  const recordsByDay: { [key: string]: BatidaDePonto[] } = records.reduce((acc, record) => {
    const dateKey = record.timestamp.toLocaleDateString('pt-BR'); // Ex: "18/06/2025"
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(record);
    return acc;
  }, {} as { [key: string]: BatidaDePonto[] });

  // Obter as chaves (datas) e ordená-las da mais recente para a mais antiga
  const sortedDates = Object.keys(recordsByDay).sort((a, b) => {
    // Convertendo para Date para comparar, assume formato dd/mm/yyyy
    const [dayA, monthA, yearA] = a.split('/').map(Number);
    const [dayB, monthB, yearB] = b.split('/').map(Number);
    const dateA = new Date(yearA, monthA - 1, dayA);
    const dateB = new Date(yearB, monthB - 1, dayB);
    return dateB.getTime() - dateA.getTime(); // Mais recente primeiro
  });

  return (
    <div className={styles.historyTableContainer}>
      {sortedDates.map(dateKey => (
        <div key={dateKey} className={styles.dayGroup}>
          <h4 className={styles.dayHeader}>
            <FaCalendarAlt className={styles.calendarIcon} /> {dateKey}
          </h4>
          <ul className={styles.punchList}>
            {recordsByDay[dateKey]
              .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) // Ordena por hora dentro do dia
              .map(record => (
                <li key={record.id} className={styles.punchItem}>
                  <div className={styles.punchDetails}>
                    <span className={styles.punchType}>
                      {punchTypeMap[record.type].icon}
                      {punchTypeMap[record.type].label}:
                    </span>
                    <span className={styles.punchTime}>
                      {record.timestamp.toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}