import { createContext } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

// The context object lives apart from ThemeProvider so the provider's file
// exports only a component, which is what React Fast Refresh needs to swap it
// in place.
export const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
});
