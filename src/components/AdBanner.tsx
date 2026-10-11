import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface AdBannerProps {
  enabled: boolean;
}

export const AdBanner: React.FC<AdBannerProps> = ({ enabled }) => {
  if (!enabled) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 pointer-events-none">
      <div className="max-w-md mx-auto h-12 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-center px-4 text-xs text-zinc-500 shadow-2xl backdrop-blur-md pointer-events-auto">
        <ShieldCheck className="w-4 h-4 mr-2 text-emerald-500/80" />
        <span>Espacio Publicitario Discreto (Banner Nativo)</span>
      </div>
    </div>
  );
};