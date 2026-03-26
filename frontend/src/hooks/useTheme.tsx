import { createContext, useContext, useState, type ReactNode } from 'react';
import { themes, type FontSizeName } from '../styles/themes';

interface ThemeContextType {
  fontSize: FontSizeName;
  setFontSize: (size: FontSizeName) => void;
  colors: typeof themes.monochrome;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSize] = useState<FontSizeName>('large');
  const colors = themes.monochrome;

  return (
    <ThemeContext.Provider value={{ fontSize, setFontSize, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
