// components/EmployeeList.tsx
'use client';

import React from 'react';
import Link from 'next/link'; // Importe o componente Link
import styles from './EmployeeList.module.scss';

// Interface para um funcionário
interface Employee {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  createdAt: Date;
}

interface EmployeeListProps {
  employees: Employee[];
}

export default function EmployeeList({ employees }: EmployeeListProps) {
  return (
    <div className={styles.employeeListContainer}>
      <h3 className={styles.title}>Funcionários Cadastrados</h3>
      {employees.length === 0 ? (
        <p className={styles.noEmployeesMessage}>Nenhum funcionário cadastrado.</p>
      ) : (
        <ul className={styles.list}>
          {employees.map((employee) => (
            <li key={employee.uid} className={styles.listItem}>
              {/* Tornar o nome um link para a nova página de histórico */}
              <Link href={`/admin/employee/${employee.uid}`} className={styles.employeeNameLink}>
                <span className={styles.employeeName}>{employee.name}</span>
              </Link>
              <span className={styles.employeeEmail}>{employee.email}</span>
              <span className={styles.employeeRole}>({employee.role})</span>
              <span className={styles.employeeDate}>
                Cadastrado em: {employee.createdAt.toLocaleDateString('pt-BR')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}