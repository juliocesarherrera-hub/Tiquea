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
const DEFAULT_SETTINGS: Settings = { provider: 'gemini', apiKey: '', adsEnabled: true };

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadSettings(): Settings {
  return readStorage<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }));
  } catch {
    // Ignore write errors
  }
}

export function getHistory(): HistoryRecord[] {
  const history = readStorage<HistoryRecord[]>(HISTORY_KEY, []);

  if (!Array.isArray(history)) return [];

  return history.filter((record) => {
    if (!record || typeof record !== 'object') return false;
    return (
      typeof record.id === 'string' &&
      typeof record.date === 'string' &&
      typeof record.type === 'string' &&
      typeof record.totalCents === 'number' &&
      typeof record.peopleCount === 'number' &&
      Array.isArray(record.results)
    );
  });
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