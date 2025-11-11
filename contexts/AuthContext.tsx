import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  login: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CORRECT_PASSWORD = 'dogmatic';
const AUTH_KEY = 'dogmatic_auth';
const USER_ID_KEY = 'dogmatic_userId';
const USER_ID = 'dogmatic1';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already authenticated
    const auth = sessionStorage.getItem(AUTH_KEY);
    const storedUserId = sessionStorage.getItem(USER_ID_KEY);

    if (auth === 'true' && storedUserId) {
      setIsAuthenticated(true);
      setUserId(storedUserId);
    }
  }, []);

  const login = (password: string): boolean => {
    if (password === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
      setUserId(USER_ID);
      sessionStorage.setItem(AUTH_KEY, 'true');
      sessionStorage.setItem(USER_ID_KEY, USER_ID);
      console.log('✅ User logged in with userId:', USER_ID);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserId(null);
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(USER_ID_KEY);
    console.log('🚪 User logged out');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
