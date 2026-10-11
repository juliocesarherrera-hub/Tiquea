export type Screen = 'home' | 'quick' | 'detailed' | 'scanner' | 'results' | 'settings';
export type AIProvider = 'gemini' | 'openai';
export type TipType = 'percentage' | 'fixed';

export interface Person {
  id: string;
  name: string;
}

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  confidence?: number;
  assignedTo: string[];
}

export interface Tip {
  type: TipType;
  value: number;
}

export interface PersonResult {
  personId: string;
  personName: string;
  items: Array<{
    name: string;
    amountCents: number;
    sharedWith: number;
  }>;
  subtotalCents: number;
  tipCents: number;
  totalCents: number;
}

export interface Settings {
  provider: AIProvider;
  apiKey: string;
  adsEnabled: boolean;
}