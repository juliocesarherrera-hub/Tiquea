import { ArrowLeft } from 'lucide-react';
import { legalContent, type LegalModalKey } from '../config/legalContent';

interface LegalPageProps {
  legalKey: LegalModalKey;
  onBack: () => void;
}

export function LegalPage({ legalKey, onBack }: LegalPageProps) {
  const content = legalContent[legalKey];

  return (
    <main className="max-w-md mx-auto p-6 pt-6 space-y-6">
      <button onClick={onBack} className="flex items-center text-zinc-400 text-sm">
        <ArrowLeft className="w-4 h-4 mr-2" /> Regresar
      </button>

      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">{content.title}</h1>
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3 text-xs text-zinc-400 leading-relaxed">
          {content.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </main>
  );
}
