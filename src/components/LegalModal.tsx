import { X } from 'lucide-react';
import { legalContent, type LegalModalKey } from '../config/legalContent';

interface LegalModalProps {
  activeKey: LegalModalKey | null;
  onClose: () => void;
}

export function LegalModal({ activeKey, onClose }: LegalModalProps) {
  if (!activeKey) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-lg w-full space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">{legalContent[activeKey].title}</h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white" aria-label="Cerrar política legal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-zinc-400 space-y-3 leading-relaxed">
          {legalContent[activeKey].body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
