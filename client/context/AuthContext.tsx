import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  token: string | null;
  email: string | null;
  loading: boolean;
  login: (token: string, email: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  email: null,
  loading: true,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("jwt_token");
    const storedEmail = localStorage.getItem("jwt_email");
    if (storedToken) setToken(storedToken);
    if (storedEmail) setEmail(storedEmail);
    setLoading(false);
  }, []);

  const login = (t: string, e: string) => {
    localStorage.setItem("jwt_token", t);
    localStorage.setItem("jwt_email", e);
    setToken(t);
    setEmail(e);
  };

  const logout = () => {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("jwt_email");
    setToken(null);
    setEmail(null);
  };

  return (
    <AuthContext.Provider value={{ token, email, loading, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
