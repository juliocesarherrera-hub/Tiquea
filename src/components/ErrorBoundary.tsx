import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error no capturado:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-xl font-bold">
            !
          </div>
          <h1 className="text-xl font-bold">Algo salió mal</h1>
          <p className="text-xs text-zinc-400 max-w-xs">
            Ocurrió un problema inesperado al cargar la aplicación.
          </p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="px-5 py-2.5 bg-emerald-500 text-black font-extrabold text-xs rounded-xl hover:bg-emerald-400 transition-all"
          >
            Reiniciar Aplicación
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}