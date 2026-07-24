import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import * as CryptoLib from "./crypto";
import { trpc } from "./trpc";
import {
  initializeNotifications,
  subscribeToNotifications,
} from "./notifications";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { disconnectWebSocket } from "./websocket";
import { useQueryClient } from "@tanstack/react-query";
import { setSessionToken, removeSessionToken } from "./_core/auth";

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
  register: (
    username: string,
    publicId: string,
    iconUrl?: string,
  ) => Promise<void>;
  login: (publicId: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const router = useRouter();
  const queryClient = useQueryClient();
  const isInitializing = useRef(false);
  
  const registerMutation = trpc.dm.register.useMutation();
  const loginMutation = trpc.auth.login.useMutation();
  const registerFCMMutation = trpc.dm.registerFCMToken.useMutation();

  // Initialize notifications and subscribe to events
  React.useEffect(() => {
    const setupNotifications = async () => {
      try {
        await initializeNotifications();
      } catch (error) {
        console.error("Failed to initialize notifications:", error);
      }
    };

    setupNotifications();

    const unsubscribe = subscribeToNotifications(
      (notification) => {
        console.log("Notification received:", notification);
      },
      (response) => {
        const data = response.notification.request.content.data;
        console.log("Notification tapped:", data);

        // Navigate to chat if conversationId is provided
        if (data.conversationId) {
          router.push({
            pathname: "/(tabs)",
            params: {
              screen: "chat",
              conversationId: String(data.conversationId),
            },
          });
        }
      },
    );

    return unsubscribe;
  }, [router]);

  const registerFCMToken = useCallback(async () => {
    try {
      const fcmToken = await initializeNotifications();
      if (fcmToken && state.user) {
        console.log("FCM Token obtained:", fcmToken);
        // Store FCM token locally
        await SecureStore.setItemAsync("fcm_token", fcmToken);
        // Send FCM token to backend
        try {
          await registerFCMMutation.mutateAsync({
            fcmToken,
          });
          console.log("FCM token registered with backend");
        } catch (backendError) {
          console.error(
            "Failed to register FCM token with backend:",
            backendError,
          );
        }
      }
    } catch (error) {
      console.error("Failed to register FCM token:", error);
    }
  }, [registerFCMMutation, state.user]);

  const login = useCallback(
    async (publicId: string) => {
      try {
        dispatch({ type: "SET_LOADING", payload: true });
        dispatch({ type: "CLEAR_ERROR" });

        const timestamp = Date.now();
        const nonce = await CryptoLib.generateNonce();
        const privateKey = await CryptoLib.getPrivateKey();

        if (!privateKey) {
          throw new Error("Private key not found. Please register first.");
        }

        // Sign the publicId + timestamp + nonce
        const signature = await CryptoLib.createRequestSignature(
          publicId,
          timestamp,
          nonce,
        );

        // Login with backend
        const result = await loginMutation.mutateAsync({
          publicId,
          timestamp,
          nonce,
          signature,
        });

        // Persist token for tRPC and other requests
        await setSessionToken(result.token);

        dispatch({
          type: "SET_SIGNED_IN",
          payload: {
            user: result.user,
            token: result.token,
          },
        });

        // Register FCM token AFTER user state is set
        await registerFCMToken();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Login failed";
        dispatch({ type: "SET_ERROR", payload: errorMessage });
        throw error;
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [loginMutation, registerFCMToken, dispatch],
  );

  // Initialize auth state on mount
  React.useEffect(() => {
    const initializeAuth = async () => {
      if (isInitializing.current) return;
      isInitializing.current = true;
      
      try {
        const keysExist = await CryptoLib.keysExist();
        if (keysExist) {
          const publicId = await CryptoLib.getPublicId();
          if (publicId) {
            // Try to restore session
            await login(publicId);
          } else {
            dispatch({ type: "SET_LOADING", payload: false });
          }
        } else {
          dispatch({ type: "SET_LOADING", payload: false });
        }
      } catch (error) {
        console.error("Failed to initialize auth:", error);
        dispatch({ type: "SET_LOADING", payload: false });
      } finally {
      }
    };

    initializeAuth();
  }, [login]);

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

        // Register FCM token
        await registerFCMToken();

        // Auto login after registration
        await login(publicId);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Registration failed";
        // Rollback local keys if registration failed after saving them
        await CryptoLib.deleteKeys();
        dispatch({ type: "SET_ERROR", payload: errorMessage });
        throw error;
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [registerFCMToken, login, registerMutation, dispatch],
  );

  const logout = useCallback(async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });

      // 1. Disconnect WebSocket
      disconnectWebSocket();

      // 2. Clear React Query cache
      queryClient.clear();

      // 3. Delete local authentication data
      await CryptoLib.deleteKeys();
      await SecureStore.deleteItemAsync("fcm_token");
      await removeSessionToken();

      dispatch({ type: "SET_SIGNED_OUT" });
      
      // Reset initialization flag so it can re-init if needed
      isInitializing.current = false;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Logout failed";
      dispatch({ type: "SET_ERROR", payload: errorMessage });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [queryClient]);

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
