export type Role = 'recruiter' | 'developer' | 'friend' | null;

export interface SectionData {
  id: string;
  title: string;
  type: 'hero' | 'about' | 'skills' | 'experience' | 'projects' | 'contact';
  content: string; // In a real app, this might be structured data
  imageUrl?: string;
}

export const SECTION_ORDER = ['hero', 'about', 'skills', 'experience', 'projects', 'contact'];

export interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}
