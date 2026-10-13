interface CookieConsentBannerProps {
  onAccept: () => void;
  onReject: () => void;
}

export function CookieConsentBanner({ onAccept, onReject }: CookieConsentBannerProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="max-w-md mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-bold text-white">Privacidad y cookies</p>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Usamos cookies necesarias para el funcionamiento de la app y analítica básica para mejorar la experiencia. Puedes aceptar o rechazar cookies no esenciales.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAccept}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-black font-extrabold text-xs hover:bg-emerald-400 transition-all"
            >
              Aceptar
            </button>
            <button
              onClick={onReject}
              className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-200 font-bold text-xs hover:bg-zinc-700 transition-all"
            >
              Rechazar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
