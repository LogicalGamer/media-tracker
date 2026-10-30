import { useSyncExternalStore } from "react";

// Dark (default) or light look. Saved on this device. The choice is applied by
// putting the "dark" class on <html>, which switches the colors in index.css.

export type Theme = "dark" | "light";
const KEY = "theme";

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark"; // storage unavailable: use the default
  }
}

let current: Theme = read();
const listeners = new Set<() => void>();

/** Called once at startup (main.tsx) so the right colors show from the first frame. */
export function applyTheme(theme: Theme = current) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: Theme) {
  current = theme;
  applyTheme(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // not saved, but still applied for this session
  }
  listeners.forEach((notify) => notify());
}

/** The current theme and a setter. Every component using it re-renders when it changes. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => current,
  );
  return [theme, setTheme];
}
