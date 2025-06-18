// app/admin/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './dashboard.module.scss'; // IMPORTA O CSS ESPECÍFICO DO DASHBOARD

// REMOVA ESTAS DUAS LINHAS:
// import AddEmployeeForm from '@/components/AddEmployeeForm';
// import { FaUserPlus, FaTimes } from 'react-icons/fa'; // Se não forem usadas em outro lugar nesta página

import EmployeeList from '@/components/EmployeeList'; // Mantenha, pois você ainda vai listar

interface Employee {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  createdAt: Date;
}

export default function AdminDashboardPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);
  // REMOVA: const [showAddEmployeeForm, setShowAddEmployeeForm] = useState(false);
  const { currentUser, loading, isAdmin } = useAuth();
  const router = useRouter();

  const fetchEmployees = useCallback(async () => {
    try {
      setError(null);
      const q = query(collection(db, 'users'), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      const employeesList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          name: data.name,
          email: data.email,
          role: data.role,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        } as Employee;
      });
      setEmployees(employeesList);
    } catch (err) {
      console.error("Erro ao buscar funcionários:", err);
      setError("Erro ao carregar lista de funcionários.");
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!currentUser || !isAdmin) {
        console.log("AdminDashboardPage: Not admin or not logged in, redirecting.");
        router.push('/login');
      } else {
        console.log("AdminDashboardPage: User is admin, fetching employees.");
        fetchEmployees();
      }
    } else {
      console.log("AdminDashboardPage: Still loading auth state...");
    }
  }, [currentUser, loading, isAdmin, router, fetchEmployees]);

  if (loading || !currentUser || !isAdmin) {
    console.log("AdminDashboardPage: Rendering loading/redirecting state.", {loading, currentUser: !!currentUser, isAdmin});
    return (
      <div className={styles.loadingContainer}>
        <p>Carregando ou verificando permissões...</p>
      </div>
    );
  }

  // REMOVA ESTA FUNÇÃO:
  // const handleEmployeeAdded = () => {
  //   fetchEmployees();
  //   setShowAddEmployeeForm(false);
  // };

  return (
    <div className={styles.dashboardContent}>
      <h2 className={styles.welcomeTitle}>Bem-vindo, Administrador!</h2>
      <p className={styles.welcomeSubtitle}>Gerencie seus funcionários e dados do sistema.</p>

      {error && <p className="error-message">{error}</p>}

      {/* REMOVA TODO ESTE BLOCO DO BOTÃO "Adicionar Novo Funcionário": */}
      {/*
      <button
        onClick={() => setShowAddEmployeeForm(!showAddEmployeeForm)}
        className={styles.toggleAddEmployeeButton}
      >
        {showAddEmployeeForm ? (
          <>
            <FaTimes className={styles.buttonIcon} />
            <span>Fechar Formulário</span>
          </>
        ) : (
          <>
            <FaUserPlus className={styles.buttonIcon} />
            <span>Adicionar Novo Funcionário</span>
          </>
        )}
      </button>
      */}

      {/* REMOVA TODO ESTE BLOCO DO FORMULÁRIO DE ADIÇÃO: */}
      {/*
      {showAddEmployeeForm && (
        <div className={styles.addEmployeeFormWrapper}>
          <AddEmployeeForm onEmployeeAdded={handleEmployeeAdded} />
        </div>
      )}
      */}

      <div className={styles.employeeListWrapper}>
        <EmployeeList employees={employees} />
      </div>
    </div>
  );
}