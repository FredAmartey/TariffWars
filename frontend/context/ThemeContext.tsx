import React, { createContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'tariffwars-theme';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: true,
  toggleTheme: () => {},
});

function getInitialIsDarkMode(): boolean {
  if (typeof window === 'undefined') return true;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark') return true;
  if (stored === 'light') return false;

  // No stored preference yet: defer to the OS setting, falling back to dark
  // (this app's original, and still primary, look) if the OS has no opinion
  // either.
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return true;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(getInitialIsDarkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    // .dark-scrollbar lives on <body>, a separate element from the root
    // <html> that carries the `dark` class above; frontend/index.css still
    // targets it directly for the webkit scrollbar rules.
    document.body.classList.toggle('dark-scrollbar', isDarkMode);
    window.localStorage.setItem(STORAGE_KEY, isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>{children}</ThemeContext.Provider>
  );
};
