import type { Settings } from '../app/types';

const KEY = 'split_bill_settings_v2';

const DEFAULT_SETTINGS: Settings = {
  provider: 'gemini',
  apiKey: '',
  adsEnabled: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      provider: parsed.provider === 'openai' ? 'openai' : 'gemini',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      adsEnabled: typeof parsed.adsEnabled === 'boolean' ? parsed.adsEnabled : true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}