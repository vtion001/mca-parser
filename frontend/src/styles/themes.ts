export interface ThemeColors {
  primary: string;
  bg: string;
  card: string;
  text: string;
  border: string;
  muted: string;
}

export const themes = {
  monochrome: {
    primary: '#000000',
    bg: '#ffffff',
    card: '#ffffff',
    text: '#111111',
    border: '#e5e5e5',
    muted: '#666666',
  },
};

export type ThemeName = 'monochrome';

export const fontSizes = {
  small: '14px',
  large: '16px',
};

export type FontSizeName = 'small' | 'large';
