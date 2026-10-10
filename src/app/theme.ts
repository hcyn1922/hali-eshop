import { useCallback, useState } from 'react';

/** Light/dark theme saved per browser; defaults to the system setting. */
export function useTheme() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('hali_theme', next ? 'dark' : 'light');
    } catch {
      // Storage unavailable: the choice lasts for this visit
    }
    setIsDark(next);
  }, []);
  return { isDark, toggle };
}
