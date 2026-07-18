import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

const STORAGE_KEY_DARK_MODE = "settings_dark_mode";

function hexToRgb(hex: string): string {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
    : "";
}

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(systemScheme);

  // Load persisted color scheme from AsyncStorage on mount
  useEffect(() => {
    let isMounted = true;
    const loadPersistedScheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_DARK_MODE);
        if (!isMounted) return;
        if (saved === "dark" || saved === "light") {
          setColorSchemeState(saved);
          applyScheme(saved);
        }
      } catch (error) {
        console.error("[ThemeProvider] Failed to load persisted color scheme:", error);
      }
    };
    void loadPersistedScheme();
    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyScheme = useCallback((scheme: ColorScheme) => {
    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, hexToRgb(value));
      });
    }
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    // Persist to AsyncStorage (works on both native and web)
    AsyncStorage.setItem(STORAGE_KEY_DARK_MODE, scheme).catch((error) => {
      console.error("[ThemeProvider] Failed to persist color scheme:", error);
    });
  }, []);

  // Single source of truth for applying the theme: whenever colorScheme state changes
  useEffect(() => {
    applyScheme(colorScheme);
  }, [applyScheme, colorScheme]);

  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": hexToRgb(SchemeColors[colorScheme].primary),
        "color-background": hexToRgb(SchemeColors[colorScheme].background),
        "color-surface": hexToRgb(SchemeColors[colorScheme].surface),
        "color-foreground": hexToRgb(SchemeColors[colorScheme].foreground),
        "color-muted": hexToRgb(SchemeColors[colorScheme].muted),
        "color-border": hexToRgb(SchemeColors[colorScheme].border),
        "color-success": hexToRgb(SchemeColors[colorScheme].success),
        "color-warning": hexToRgb(SchemeColors[colorScheme].warning),
        "color-error": hexToRgb(SchemeColors[colorScheme].error),
      }),
    [colorScheme],
  );

  const value = useMemo(
    () => ({
      colorScheme,
      setColorScheme,
    }),
    [colorScheme, setColorScheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
