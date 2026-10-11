import type { Settings, PersonResult } from '../app/types';

export interface HistoryRecord {
  id: string;
  date: string;
  type: 'Rápido' | 'Detallado';
  totalCents: number;
  peopleCount: number;
  results: PersonResult[];
}

const SETTINGS_KEY = 'tiquea_settings';
const HISTORY_KEY = 'tiquea_history';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { provider: 'gemini', apiKey: '', adsEnabled: true };
    return JSON.parse(raw);
  } catch {
    return { provider: 'gemini', apiKey: '', adsEnabled: true };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore write errors
  }
}

export function getHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveHistoryRecord(record: Omit<HistoryRecord, 'id' | 'date'>): HistoryRecord[] {
  try {
    const currentHistory = getHistory();
    const newRecord: HistoryRecord = {
      ...record,
      id: `rec_${Date.now()}`,
      date: new Date().toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    // Guardar máximo las últimas 5 cuentas
    const updated = [newRecord, ...currentHistory].slice(0, 5);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return getHistory();
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // Ignore
  }
}