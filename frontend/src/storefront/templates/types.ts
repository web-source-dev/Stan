import type { Block } from '../schema/types';

export interface StoreTemplateTheme {
  fontPair: string;
  buttonStyle: string;
  cardStyle: string;
  background: string;
  accent: string;
  accent2?: string;
  backgroundStyle?: 'flat' | 'solid' | 'gradient' | 'mesh';
  spacing?: 'compact' | 'comfortable' | 'airy';
  cardChrome?: 'elevated' | 'flat' | 'glass';
  motion?: 'none' | 'subtle' | 'expressive';
}

export interface StoreTemplate {
  id: string;
  name: string;
  /** Carousel / picker preview — defaults to `/stan/themes/{id}.png` */
  previewImage?: string;
  theme: StoreTemplateTheme;
  build: () => Block[];
}
