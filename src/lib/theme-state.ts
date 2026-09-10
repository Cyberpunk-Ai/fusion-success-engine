import { useState, useEffect, useCallback } from "react";

import { attachRemoteRecord } from "@/lib/remote-store";

export type ThemeMode = "light" | "dark" | "system";
export type ThemeAccent = "violet" | "amber" | "emerald" | "rose" | "indigo";

export interface AccentDefinition {
  id: ThemeAccent;
  name: string;
  gradientClass: string;
  brand: string;
  brandPink: string;
  brandOrange: string;
}

export const ACCENT_PALETTES: Record<ThemeAccent, AccentDefinition> = {
  violet: {
    id: "violet",
    name: "Violet & Magenta",
    gradientClass: "from-violet-500 to-fuchsia-500",
    brand: "oklch(0.541 0.281 293.009)",
    brandPink: "oklch(0.656 0.241 354.308)",
    brandOrange: "oklch(0.705 0.213 47.604)",
  },
  amber: {
    id: "amber",
    name: "Golden Amber",
    gradientClass: "from-amber-500 to-rose-500",
    brand: "oklch(0.66 0.21 55)",
    brandPink: "oklch(0.62 0.22 35)",
    brandOrange: "oklch(0.75 0.18 65)",
  },
  emerald: {
    id: "emerald",
    name: "Emerald & Teal",
    gradientClass: "from-emerald-500 to-teal-500",
    brand: "oklch(0.62 0.19 155)",
    brandPink: "oklch(0.65 0.16 180)",
    brandOrange: "oklch(0.72 0.15 140)",
  },
  rose: {
    id: "rose",
    name: "Neon Rose",
    gradientClass: "from-pink-500 to-rose-600",
    brand: "oklch(0.58 0.24 15)",
    brandPink: "oklch(0.64 0.22 350)",
    brandOrange: "oklch(0.68 0.21 30)",
  },
  indigo: {
    id: "indigo",
    name: "Cosmic Indigo",
    gradientClass: "from-indigo-500 to-cyan-500",
    brand: "oklch(0.52 0.24 265)",
    brandPink: "oklch(0.60 0.22 290)",
    brandOrange: "oklch(0.65 0.18 220)",
  },
};

const THEME_STORAGE_KEY = "spaces_theme_mode";
const ACCENT_STORAGE_KEY = "spaces_accent_theme";
const MOTION_STORAGE_KEY = "spaces_reduce_motion";
const TEXT_STORAGE_KEY = "spaces_larger_text";
const THEME_CHANGE_EVENT = "spaces:theme-change";

export interface ThemeSettings {
  mode: ThemeMode;
  accent: ThemeAccent;
  reduceMotion: boolean;
  largerText: boolean;
}

const THEME_DEFAULTS: ThemeSettings = {
  mode: "light",
  accent: "violet",
  reduceMotion: false,
  largerText: false,
};

function readStoredTheme(): ThemeSettings {
  if (typeof window === "undefined") return THEME_DEFAULTS;
  try {
    const mode = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    const accent = window.localStorage.getItem(ACCENT_STORAGE_KEY) as ThemeAccent | null;
    return {
      mode: mode === "light" || mode === "dark" || mode === "system" ? mode : THEME_DEFAULTS.mode,
      
      accent: accent && accent in ACCENT_PALETTES ? accent : THEME_DEFAULTS.accent,
      reduceMotion: window.localStorage.getItem(MOTION_STORAGE_KEY) === "1",
      largerText: window.localStorage.getItem(TEXT_STORAGE_KEY) === "1",
    };
  } catch {
    return THEME_DEFAULTS;
  }
}

let inMemoryTheme: ThemeSettings = readStoredTheme();

function persistTheme(settings: ThemeSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, settings.mode);
    window.localStorage.setItem(ACCENT_STORAGE_KEY, settings.accent);
    window.localStorage.setItem(MOTION_STORAGE_KEY, settings.reduceMotion ? "1" : "0");
    window.localStorage.setItem(TEXT_STORAGE_KEY, settings.largerText ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

/** Keeps appearance choices with the account, so they follow the user across devices. */
const remoteTheme = attachRemoteRecord<ThemeSettings>({
  table: "user_preferences",
  fromRow: (row) => ({
    mode: (row.theme ?? "light") as ThemeMode,
    accent: (row.accent ?? "violet") as ThemeAccent,
    reduceMotion: Boolean(row.reduce_motion),
    largerText: Boolean(row.larger_text),
  }),
  toRow: (s) => ({
    theme: s.mode,
    accent: s.accent,
    reduce_motion: s.reduceMotion,
    larger_text: s.largerText,
  }),
  apply: (patch) => {
    inMemoryTheme = { ...inMemoryTheme, ...patch };
    persistTheme(inMemoryTheme);
    applyThemeToDOM(inMemoryTheme);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
    }
  },
});

export function getStoredThemeSettings(): ThemeSettings {
  if (typeof window === "undefined") {
    return inMemoryTheme;
  }
  return { ...inMemoryTheme };
}

export function applyThemeToDOM(settings: ThemeSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // 1. Dark mode
  const isDark =
    settings.mode === "dark" ||
    (settings.mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // 2. Accent color variables
  const palette = ACCENT_PALETTES[settings.accent] || ACCENT_PALETTES.violet;
  root.style.setProperty("--brand", palette.brand);
  root.style.setProperty("--brand-pink", palette.brandPink);
  root.style.setProperty("--brand-orange", palette.brandOrange);

  // 3. Reduced motion
  if (settings.reduceMotion) {
    root.classList.add("reduce-motion");
  } else {
    root.classList.remove("reduce-motion");
  }

  // 4. Larger text
  if (settings.largerText) {
    root.style.fontSize = "17.5px";
  } else {
    root.style.fontSize = "";
  }
}

export function useTheme() {
  // Start from defaults so the server-rendered markup matches the first client
  // render; the saved choice is applied right after hydration.
  const [settings, setSettings] = useState<ThemeSettings>(THEME_DEFAULTS);

  useEffect(() => {
    setSettings(getStoredThemeSettings());
  }, []);

  useEffect(() => {
    applyThemeToDOM(settings);

    const handleSystemChange = () => {
      if (settings.mode === "system") {
        applyThemeToDOM(settings);
      }
    };

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", handleSystemChange);

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === THEME_STORAGE_KEY ||
        e.key === ACCENT_STORAGE_KEY ||
        e.key === MOTION_STORAGE_KEY ||
        e.key === TEXT_STORAGE_KEY
      ) {
        const fresh = getStoredThemeSettings();
        setSettings(fresh);
        applyThemeToDOM(fresh);
      }
    };

    const handleCustomChange = () => {
      const fresh = getStoredThemeSettings();
      setSettings(fresh);
      applyThemeToDOM(fresh);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(THEME_CHANGE_EVENT, handleCustomChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, handleCustomChange);
    };
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<ThemeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      inMemoryTheme = next;
      persistTheme(next);
      applyThemeToDOM(next);
      remoteTheme.push(next);
      return next;
    });
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => {
      const isCurrentlyDark =
        prev.mode === "dark" ||
        (prev.mode === "system" &&
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);

      const nextMode: ThemeMode = isCurrentlyDark ? "light" : "dark";
      const next = { ...prev, mode: nextMode };
      inMemoryTheme = next;
      persistTheme(next);
      applyThemeToDOM(next);
      remoteTheme.push(next);
      return next;
    });
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
    });
  }, []);

  const isDark =
    typeof window !== "undefined" &&
    (settings.mode === "dark" ||
      (settings.mode === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches));

  return {
    ...settings,
    isDark,
    setMode: (mode: ThemeMode) => updateSettings({ mode }),
    setAccent: (accent: ThemeAccent) => updateSettings({ accent }),
    setReduceMotion: (reduceMotion: boolean) => updateSettings({ reduceMotion }),
    setLargerText: (largerText: boolean) => updateSettings({ largerText }),
    toggleTheme,
  };
}

/**
 * Applied from the root component after hydration — running it at module scope
 * mutates <html> before React hydrates and causes an attribute mismatch.
 */
export function bootstrapTheme() {
  if (typeof window === "undefined") return;
  try {
    applyThemeToDOM(getStoredThemeSettings());
  } catch (e) {
    console.error("Theme initial apply error:", e);
  }
}
