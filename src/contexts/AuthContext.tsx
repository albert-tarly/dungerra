import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { AuthManager } from "../api/AuthManager";

interface IAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<IAuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const authManager = AuthManager.getInstance();

  const checkAuth = useCallback(async (): Promise<void> => {
    try {
      authManager.initToken();
      await authManager.checkAuthStatus();
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, [authManager]);

  const logout = useCallback((): void => {
    authManager.logout();
    setIsAuthenticated(false);
  }, [authManager]);

  useEffect(() => {
    // Initial auth check on mount. State is set after the request settles, so
    // this does not cascade renders; the rule cannot see past the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isLoading, checkAuth, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): IAuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
