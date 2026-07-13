import React, { createContext, useContext, useReducer, useCallback, ReactNode } from "react";
import * as CryptoLib from "./crypto";
import { trpc } from "./trpc";

export interface User {
  id: number;
  publicId: string;
  username: string;
  iconUrl: string | null;
}

export interface AuthState {
  isLoading: boolean;
  isSignedIn: boolean;
  user: User | null;
  token: string | null;
  error: string | null;
}

type AuthAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SIGNED_IN"; payload: { user: User; token: string } }
  | { type: "SET_SIGNED_OUT" }
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" };

const initialState: AuthState = {
  isLoading: true,
  isSignedIn: false,
  user: null,
  token: null,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_SIGNED_IN":
      return {
        ...state,
        isSignedIn: true,
        user: action.payload.user,
        token: action.payload.token,
        error: null,
      };
    case "SET_SIGNED_OUT":
      return {
        ...state,
        isSignedIn: false,
        user: null,
        token: null,
        error: null,
      };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

interface AuthContextType {
  state: AuthState;
  register: (username: string, publicId: string, iconUrl?: string) => Promise<void>;
  login: (publicId: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const registerMutation = trpc.dm.register.useMutation();
  const loginMutation = trpc.auth.login.useMutation();

  // Initialize auth state on mount
  React.useEffect(() => {
    const initializeAuth = async () => {
      try {
        const keysExist = await CryptoLib.keysExist();
        if (keysExist) {
          const publicId = await CryptoLib.getPublicId();
          if (publicId) {
            // Try to restore session
            dispatch({ type: "SET_LOADING", payload: false });
          } else {
            dispatch({ type: "SET_LOADING", payload: false });
          }
        } else {
          dispatch({ type: "SET_LOADING", payload: false });
        }
      } catch (error) {
        console.error("Failed to initialize auth:", error);
        dispatch({ type: "SET_LOADING", payload: false });
      }
    };

    initializeAuth();
  }, []);

  const register = useCallback(
    async (username: string, publicId: string, iconUrl?: string) => {
      try {
        dispatch({ type: "SET_LOADING", payload: true });
        dispatch({ type: "CLEAR_ERROR" });

        // Generate key pair
        const { publicKey, privateKey } = await CryptoLib.generateKeyPair();

        // Save keys locally
        await CryptoLib.savePrivateKey(privateKey);
        await CryptoLib.savePublicKey(publicKey);
        await CryptoLib.savePublicId(publicId);

        // Register with backend
        const result = await registerMutation.mutateAsync({
          username,
          publicId,
          publicKey,
          iconUrl,
        });

        // Auto login after registration
        await login(publicId);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Registration failed";
        dispatch({ type: "SET_ERROR", payload: errorMessage });
        throw error;
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [registerMutation]
  );

  const login = useCallback(
    async (publicId: string) => {
      try {
        dispatch({ type: "SET_LOADING", payload: true });
        dispatch({ type: "CLEAR_ERROR" });

        const timestamp = Date.now();
        const privateKey = await CryptoLib.getPrivateKey();

        if (!privateKey) {
          throw new Error("Private key not found. Please register first.");
        }

        // Sign the timestamp
        const signature = await CryptoLib.createRequestSignature(
          timestamp.toString(),
          timestamp
        );

        // Login with backend
        const result = await loginMutation.mutateAsync({
          publicId,
          timestamp,
          signature,
        });

        dispatch({
          type: "SET_SIGNED_IN",
          payload: {
            user: result.user,
            token: result.token,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Login failed";
        dispatch({ type: "SET_ERROR", payload: errorMessage });
        throw error;
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [loginMutation]
  );

  const logout = useCallback(async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      await CryptoLib.deleteKeys();
      dispatch({ type: "SET_SIGNED_OUT" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Logout failed";
      dispatch({ type: "SET_ERROR", payload: errorMessage });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const value: AuthContextType = {
    state,
    register,
    login,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
