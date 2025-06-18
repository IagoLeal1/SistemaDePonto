// app/context/AuthContext.tsx
'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { auth, db } from '@/lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  const fetchUserProfile = useCallback(async (uid: string) => {
    try {
      console.log("AuthContext: Fetching user profile for UID:", uid);
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        console.log("AuthContext: User data from Firestore:", userData);
        const role = userData.role;
        setIsAdmin(role === 'admin');
        console.log("AuthContext: isAdmin set to:", role === 'admin');
        return role; // Retorna o papel para ser usado na mesma execução do useEffect
      } else {
        console.log("AuthContext: User document NOT found in Firestore for UID:", uid);
        setIsAdmin(false);
        return 'employee'; // Assumimos que não é admin se não há documento ou role
      }
    } catch (firestoreError) {
      console.error("AuthContext: Error fetching user profile from Firestore:", firestoreError);
      setIsAdmin(false);
      return 'employee';
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("AuthContext: Auth State Changed. User:", user ? user.email : "none (logged out)");
      setCurrentUser(user);
      setIsAdmin(false); // Reseta isAdmin antes de determinar o novo estado

      if (user) {
        const role = await fetchUserProfile(user.uid); // Captura o papel retornado

        // Lógica de redirecionamento mais específica APÓS o login
        if (window.location.pathname === '/login') {
          if (role === 'admin') {
            console.log("AuthContext: Admin logged in, redirecting to /admin/dashboard");
            router.push('/admin/dashboard');
          } else {
            console.log("AuthContext: Employee logged in, redirecting to /ponto");
            router.push('/ponto');
          }
        }
      } else {
        // Lógica para usuários deslogados
        // Não redirecionar se já estiver em /login ou em alguma rota /admin (que tem sua própria proteção)
        if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/admin')) {
           console.log("AuthContext: User logged out, redirecting to /login");
           router.push('/login');
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [router, fetchUserProfile]);

  return (
    <AuthContext.Provider value={{ currentUser, loading, isAdmin }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', fontSize: '1.2em', color: '#555' }}>
          <p>Carregando autenticação...</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};