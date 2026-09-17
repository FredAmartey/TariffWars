import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeContext, type Theme } from './theme';

const STORAGE_KEY = 'tariffwars-theme';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;

  // No stored preference yet: defer to the OS setting, falling back to dark
  // (this app's original, and still primary, look) if the OS has no opinion
  // either.
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    // .dark-scrollbar lives on <body>, a separate element from the root
    // <html> that carries the `dark` class above; frontend/index.css still
    // targets it directly for the webkit scrollbar rules.
    document.body.classList.toggle('dark-scrollbar', isDark);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    []
  );

  // An inline `{ theme, toggleTheme }` literal was a new object every render,
  // so every consumer re-rendered whenever the provider did, theme change or
  // not.
  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
