import { useEffect, useState } from 'react';

export type CookieConsent = 'accepted' | 'rejected' | 'undecided';

const STORAGE_KEY = 'tiquea_cookie_consent';

function readStoredConsent(): CookieConsent {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'accepted' || value === 'rejected' ? value : 'undecided';
  } catch {
    return 'undecided';
  }
}

export function useLegalConsent() {
  const [cookieConsent, setCookieConsent] = useState<CookieConsent>(() => readStoredConsent());
  const [showCookieBanner, setShowCookieBanner] = useState(() => readStoredConsent() === 'undecided');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, cookieConsent);
    } catch {
      // Ignorar errores de almacenamiento en navegadores restringidos.
    }
  }, [cookieConsent]);

  const handleCookieChoice = (choice: Exclude<CookieConsent, 'undecided'>) => {
    setCookieConsent(choice);
    setShowCookieBanner(false);
  };

  return { cookieConsent, showCookieBanner, handleCookieChoice };
}
