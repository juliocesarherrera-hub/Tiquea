import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import type { Settings, Screen, PersonResult, ReceiptItem, Tip } from './app/types';
import { loadSettings, saveSettings, getHistory, saveHistoryRecord, clearHistory, type HistoryRecord } from './services/storage';
import { calculateQuickBill, calculateDetailedBill } from './domain/calculations';
import { shareWhatsApp } from './domain/whatsapp';
import { formatCurrency } from './domain/money';
import { downloadSummaryAsImage } from './domain/exportImage';
import { TipSelector } from './components/TipSelector';
import { AdBanner } from './components/AdBanner';
import { scanReceiptWithAI } from './services/ai';
import {
  Calculator,
  Sparkles,
  Camera,
  ArrowLeft,
  CheckCircle2,
  Share2,
  RefreshCw,
  Plus,
  Trash2,
  X,
  Shield,
  FileText,
  Download,
  History,
  Clock,
  Copy,
  Check,
  DownloadCloud
} from 'lucide-react';

function resizeImage(file: File, maxWidth = 800, maxHeight = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = (err) => reject(err);
  });
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [settings] = useState<Settings>(() => ({
    ...loadSettings(),
    provider: 'gemini',
  }));

  const [scanSource, setScanSource] = useState<'quick' | 'detailed'>('detailed');
  const [modalLegal, setModalLegal] = useState<
    'privacy' | 'cookies' | 'terms' | 'delivery' | 'security' | 'contact' | null
  >(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState<HistoryRecord[]>(() => getHistory());

  // Estado para capturar evento de instalación PWA
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Estados de Modo Rápido
  const [quickTotal, setQuickTotal] = useState('');
  const [quickPeople, setQuickPeople] = useState(2);
  const [quickTip, setQuickTip] = useState<Tip>({ type: 'percentage', value: 15 });

  // Estados de Modo Detallado
  const [detailedPeople, setDetailedPeople] = useState<Array<{ id: string; name: string }>>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [detailedItems, setDetailedItems] = useState<ReceiptItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [detailedTip, setDetailedTip] = useState<Tip>({ type: 'percentage', value: 15 });

  const [results, setResults] = useState<PersonResult[]>([]);
  const [loadingScan, setLoadingScan] = useState(false);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    saveSettings(settings);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [settings]);

  const handleInstallPWA = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
  };

  const copyToClipboard = (resultsToCopy: PersonResult[]) => {
    let text = '🧾 *Resumen de Cuenta - Tiquea*\n\n';
    resultsToCopy.forEach((p) => {
      text += `👤 *${p.personName}*: ${formatCurrency(p.totalCents)}\n`;
      p.items.forEach((it) => {
        const shareInfo = it.sharedWith > 1 ? ` (1/${it.sharedWith})` : '';
        text += `  • ${it.name}${shareInfo}: ${formatCurrency(it.amountCents)}\n`;
      });
      text += '\n';
    });
    text += 'Divide tu cuenta sin peleas en https://tiquea.app';

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const resetAll = () => {
    setQuickTotal('');
    setQuickPeople(2);
    setQuickTip({ type: 'percentage', value: 15 });
    setDetailedPeople([]);
    setNewPersonName('');
    setDetailedItems([]);
    setNewItemName('');
    setNewItemPrice('');
    setDetailedTip({ type: 'percentage', value: 15 });
    setResults([]);
    setScanError('');
    setScreen('home');
  };

  const handleAddPerson = () => {
    if (!newPersonName.trim()) return;
    setDetailedPeople((prev) => [...prev, { id: `p_${Date.now()}`, name: newPersonName.trim() }]);
    setNewPersonName('');
  };

  const handleDeletePerson = (id: string) => {
    setDetailedPeople((prev) => prev.filter((p) => p.id !== id));
    setDetailedItems((prev) =>
      prev.map((item) => ({
        ...item,
        assignedTo: item.assignedTo.filter((pId) => pId !== id),
      }))
    );
  };

  const handleAddItem = () => {
    const price = parseFloat(newItemPrice);
    if (!newItemName.trim() || isNaN(price) || price < 0) return;
    setDetailedItems((prev) => [
      ...prev,
      { id: `item_${Date.now()}`, name: newItemName.trim(), price, assignedTo: [] },
    ]);
    setNewItemName('');
    setNewItemPrice('');
  };

  const handleDeleteItem = (id: string) => {
    setDetailedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleToggleAllForItem = (itemId: string) => {
    const allPersonIds = detailedPeople.map((p) => p.id);
    setDetailedItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const isEveryoneSelected =
          allPersonIds.length > 0 &&
          allPersonIds.every((id) => item.assignedTo.includes(id));

        return {
          ...item,
          assignedTo: isEveryoneSelected ? [] : [...allPersonIds],
        };
      })
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!navigator.onLine) {
      setScanError('📶 Sin conexión a internet. El escáner con IA requiere red, pero puedes usar la división manual.');
      return;
    }

    setLoadingScan(true);
    setScanError('');

    try {
      const resizedBase64 = await resizeImage(file, 800, 800);
      const res = await scanReceiptWithAI('gemini', '', resizedBase64);

      if (scanSource === 'quick') {
        const calculatedTotal = res.total || res.items.reduce((sum, item) => sum + item.price, 0);
        if (calculatedTotal > 0) {
          setQuickTotal(calculatedTotal.toFixed(2));
        }
        setScreen('quick');
      } else {
        const items: ReceiptItem[] = res.items.map((it, idx) => ({
          id: `scan_${Date.now()}_${idx}`,
          name: it.name,
          price: it.price,
          confidence: it.confidence,
          assignedTo: [],
        }));
        setDetailedItems(items);
        setScreen('detailed');
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Error al procesar la imagen.');
    } finally {
      setLoadingScan(false);
    }
  };

  const finishCalculation = (calculatedResults: PersonResult[], modeType: 'Rápido' | 'Detallado') => {
    setResults(calculatedResults);
    const totalCents = calculatedResults.reduce((sum, r) => sum + r.totalCents, 0);
    const updatedHistory = saveHistoryRecord({
      type: modeType,
      totalCents,
      peopleCount: calculatedResults.length,
      results: calculatedResults,
    });
    setHistoryList(updatedHistory);
    setScreen('results');
  };

  return (
    <div className="bg-black min-h-screen text-white font-sans selection:bg-emerald-500 selection:text-black pb-24 flex flex-col justify-between">
      <Analytics />

      <div>
        {/* 1. HOME SCREEN */}
        {screen === 'home' && (
          <main className="max-w-md mx-auto p-6 space-y-8 pt-10">
            <div className="flex justify-between items-center">
              <span className="text-2xl font-black tracking-tight text-emerald-400">
                Tiquea
              </span>
              <button
                onClick={() => setShowHistoryModal(true)}
                className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white flex items-center space-x-1.5 text-xs font-bold transition-all"
              >
                <History className="w-4 h-4 text-emerald-400" />
                <span>Historial</span>
              </button>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
                Divide tu cuenta <span className="text-emerald-400">sin peleas.</span>
              </h1>
              <p className="text-xs text-zinc-400">
                Escanea tu ticket o divide los gastos entre amigos en segundos.
              </p>
            </div>

            {deferredPrompt && (
              <button
                onClick={handleInstallPWA}
                className="w-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between hover:bg-emerald-500/20 transition-all text-xs font-bold"
              >
                <div className="flex items-center space-x-2">
                  <DownloadCloud className="w-5 h-5" />
                  <span>Instalar Tiquea en la pantalla de inicio</span>
                </div>
                <span>Instalar</span>
              </button>
            )}

            <div className="space-y-4">
              <button
                onClick={() => setScreen('quick')}
                className="w-full p-5 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center space-x-4 hover:border-emerald-500/50 transition-all"
              >
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <Calculator className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg text-white">Modo Rápido</div>
                  <div className="text-xs text-zinc-400">División equitativa entre varias personas.</div>
                </div>
              </button>

              <button
                onClick={() => setScreen('detailed')}
                className="w-full p-5 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center space-x-4 hover:border-violet-500/50 transition-all"
              >
                <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg text-white">Modo Detallado</div>
                  <div className="text-xs text-zinc-400">Escanea el ticket y asigna platillos.</div>
                </div>
              </button>
            </div>
          </main>
        )}

        {/* 2. MODO RÁPIDO */}
        {screen === 'quick' && (
          <main className="max-w-md mx-auto p-6 space-y-6 pt-6">
            <button onClick={() => setScreen('home')} className="flex items-center text-zinc-400 text-sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> Regresar
            </button>
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">Modo Rápido</h1>
              <button
                onClick={() => {
                  setScanSource('quick');
                  setScreen('scanner');
                }}
                className="px-3 py-2 rounded-xl bg-violet-500/20 text-violet-400 font-bold text-xs flex items-center hover:bg-violet-500/30 transition-all"
              >
                <Camera className="w-4 h-4 mr-1" /> Escanear
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
              <label className="text-xs font-semibold text-zinc-400 uppercase">Monto Total</label>
              <input
                type="number"
                value={quickTotal}
                onChange={(e) => setQuickTotal(e.target.value)}
                placeholder="\$0.00"
                className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-2xl font-bold text-white"
              />

              <label className="text-xs font-semibold text-zinc-400 uppercase block">
                Personas: {quickPeople}
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setQuickPeople(Math.max(1, quickPeople - 1))}
                  className="flex-1 p-3 bg-zinc-800 rounded-2xl text-xl font-bold"
                >
                  -
                </button>
                <button
                  onClick={() => setQuickPeople(quickPeople + 1)}
                  className="flex-1 p-3 bg-zinc-800 rounded-2xl text-xl font-bold"
                >
                  +
                </button>
              </div>

              <TipSelector tip={quickTip} onChange={setQuickTip} />
            </div>

            <button
              onClick={() => {
                const res = calculateQuickBill(parseFloat(quickTotal) || 0, quickPeople, quickTip.value);
                finishCalculation(res, 'Rápido');
              }}
              className="w-full py-4 rounded-2xl bg-white text-black font-extrabold text-base hover:bg-zinc-200 transition-all"
            >
              Calcular Total
            </button>
          </main>
        )}

        {/* 3. MODO DETALLADO */}
        {screen === 'detailed' && (
          <main className="max-w-md mx-auto p-6 space-y-6 pt-6">
            <button onClick={() => setScreen('home')} className="flex items-center text-zinc-400 text-sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> Regresar
            </button>
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">Modo Detallado</h1>
              <button
                onClick={() => {
                  setScanSource('detailed');
                  setScreen('scanner');
                }}
                className="px-3 py-2 rounded-xl bg-violet-500/20 text-violet-400 font-bold text-xs flex items-center hover:bg-violet-500/30 transition-all"
              >
                <Camera className="w-4 h-4 mr-1" /> Escanear
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3">
              <label className="text-xs font-semibold text-zinc-400 uppercase block">Comensales</label>
              {detailedPeople.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">Agrega personas escribiendo su nombre abajo.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {detailedPeople.map((p) => (
                    <span
                      key={p.id}
                      className="px-3 py-1 bg-zinc-800 rounded-xl text-xs font-bold flex items-center space-x-1"
                    >
                      <span>{p.name}</span>
                      <button
                        onClick={() => handleDeletePerson(p.id)}
                        className="text-zinc-400 hover:text-rose-400 ml-1"
                        title="Eliminar comensal"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex space-x-2 pt-1">
                <input
                  type="text"
                  placeholder="Nombre de la persona..."
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPerson();
                    }
                  }}
                  className="flex-1 bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
                <button
                  onClick={handleAddPerson}
                  className="px-3 py-2 bg-white text-black rounded-xl font-bold text-xs hover:bg-zinc-200 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3">
              <label className="text-xs font-semibold text-zinc-400 uppercase block">Consumos</label>
              {detailedItems.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">Agrega consumos o escanea un ticket.</p>
              ) : (
                detailedItems.map((it) => (
                  <div key={it.id} className="p-3 bg-black rounded-2xl border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold">{it.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-emerald-400">\${it.price.toFixed(2)}</span>
                        <button
                          onClick={() => handleDeleteItem(it.id)}
                          className="text-zinc-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {detailedPeople.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const allPersonIds = detailedPeople.map((p) => p.id);
                          const isEveryoneSelected =
                            allPersonIds.length > 0 &&
                            allPersonIds.every((id) => it.assignedTo.includes(id));

                          return (
                            <button
                              type="button"
                              onClick={() => handleToggleAllForItem(it.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                isEveryoneSelected
                                  ? 'bg-emerald-500 text-black font-bold'
                                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
                              }`}
                            >
                              {isEveryoneSelected ? '✓ Todos' : 'Todos'}
                            </button>
                          );
                        })()}

                        {detailedPeople.map((p) => {
                          const assigned = it.assignedTo.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              onClick={() => {
                                setDetailedItems((prev) =>
                                  prev.map((item) => {
                                    if (item.id !== it.id) return item;
                                    return {
                                      ...item,
                                      assignedTo: assigned
                                        ? item.assignedTo.filter((id) => id !== p.id)
                                        : [...item.assignedTo, p.id],
                                    };
                                  })
                                );
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                assigned ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {p.name}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-500">Agrega comensales arriba para asignar.</p>
                    )}
                  </div>
                ))
              )}

              <div className="flex space-x-2 pt-2">
                <input
                  type="text"
                  placeholder="Platillo o bebida..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem();
                    }
                  }}
                  className="flex-1 bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
                <input
                  type="number"
                  placeholder="Precio"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem();
                    }
                  }}
                  className="w-20 bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
                <button
                  onClick={handleAddItem}
                  className="p-2 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <TipSelector tip={detailedTip} onChange={setDetailedTip} />

            <button
              onClick={() => {
                const res = calculateDetailedBill(detailedPeople, detailedItems, detailedTip);
                finishCalculation(res, 'Detallado');
              }}
              className="w-full py-4 rounded-2xl bg-white text-black font-extrabold text-base hover:bg-zinc-200 transition-all"
            >
              Calcular Cuentas Exactas
            </button>
          </main>
        )}

        {/* 4. ESCÁNER */}
        {screen === 'scanner' && (
          <main className="max-w-md mx-auto p-6 space-y-6 pt-6 text-center">
            <button onClick={() => setScreen(scanSource)} className="flex items-center text-zinc-400 text-sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> Cancelar
            </button>
            <h1 className="text-2xl font-bold">Escáner de Ticket</h1>

            {scanError && (
              <div className="p-4 bg-rose-500/20 text-rose-300 text-xs rounded-2xl text-left font-mono">
                {scanError}
              </div>
            )}

            <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-4">
              <Camera className="w-12 h-12 mx-auto text-violet-400" />
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="ticket-file" />
              <label
                htmlFor="ticket-file"
                className="block w-full py-4 rounded-2xl bg-white text-black font-bold text-sm cursor-pointer hover:bg-zinc-200 transition-all"
              >
                {loadingScan ? 'Analizando Ticket' : 'Subir o Tomar Foto'}
              </label>
            </div>
          </main>
        )}

        {/* 5. RESULTADOS */}
        {screen === 'results' && (
          <main className="max-w-md mx-auto p-6 space-y-6 pt-6">
            <button onClick={() => setScreen('home')} className="flex items-center text-zinc-400 text-sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> Regresar
            </button>

            <div className="text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400" />
              <h1 className="text-2xl font-bold">Resumen Final</h1>
            </div>

            <div className="space-y-3">
              {results.map((p) => (
                <div key={p.personId} className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-2">
                  <div className="flex justify-between font-bold text-lg">
                    <span>👤 {p.personName}</span>
                    <span className="text-emerald-400">{formatCurrency(p.totalCents)}</span>
                  </div>
                  <div className="text-xs text-zinc-400 space-y-1">
                    {p.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>
                          {it.name} {it.sharedWith > 1 && `(1/${it.sharedWith})`}
                        </span>
                        <span>{formatCurrency(it.amountCents)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => shareWhatsApp(results)}
                className="w-full py-4 rounded-2xl bg-emerald-500 text-black font-extrabold flex items-center justify-center space-x-2 hover:bg-emerald-400 transition-all"
              >
                <Share2 className="w-5 h-5" />
                <span>Compartir por WhatsApp</span>
              </button>

              <button
                onClick={() => copyToClipboard(results)}
                className="w-full py-3.5 rounded-2xl bg-zinc-800 text-white font-bold flex items-center justify-center space-x-2 hover:bg-zinc-700 transition-all text-sm"
              >
                {copiedText ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">¡Copiado al portapapeles!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-emerald-400" />
                    <span>Copiar Resumen de Texto</span>
                  </>
                )}
              </button>

              <button
                onClick={() => downloadSummaryAsImage(results)}
                className="w-full py-3.5 rounded-2xl bg-zinc-800 text-white font-bold flex items-center justify-center space-x-2 hover:bg-zinc-700 transition-all text-sm"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Descargar como Imagen (PNG)</span>
              </button>

              <button
                onClick={resetAll}
                className="w-full py-3 rounded-2xl bg-zinc-900 text-zinc-400 font-bold flex items-center justify-center space-x-2 hover:bg-zinc-800 transition-all text-xs"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Nueva Cuenta</span>
              </button>
            </div>
          </main>
        )}
      </div>

      {/* MODAL DE HISTORIAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold">Últimas Cuentas</h2>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {historyList.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-4 text-center">
                Aún no tienes cuentas guardadas en el historial.
              </p>
            ) : (
              <div className="space-y-3">
                {historyList.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => {
                      setResults(rec.results);
                      setShowHistoryModal(false);
                      setScreen('results');
                    }}
                    className="p-4 bg-black border border-zinc-800 rounded-2xl hover:border-emerald-500/50 cursor-pointer transition-all space-y-1"
                  >
                    <div className="flex justify-between items-center font-bold text-sm">
                      <span className="text-emerald-400">{formatCurrency(rec.totalCents)}</span>
                      <span className="text-[10px] text-zinc-500 font-normal">{rec.date}</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Modo {rec.type}</span>
                      <span>{rec.peopleCount} comensales</span>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => {
                    clearHistory();
                    setHistoryList([]);
                  }}
                  className="w-full py-2.5 text-xs text-rose-400 hover:text-rose-300 transition-all font-semibold pt-2"
                >
                  Borrar Historial
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER Y ENLACES LEGALES */}
      <footer className="max-w-md mx-auto pt-8 pb-4 text-center space-y-3 border-t border-zinc-900 mt-8">
        <div className="flex flex-wrap justify-center gap-2 text-[11px] text-zinc-500">
          <button
            onClick={() => setModalLegal('privacy')}
            className="hover:text-zinc-300 flex items-center space-x-1 transition-all"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Privacidad</span>
          </button>
          <span>•</span>
          <button
            onClick={() => setModalLegal('cookies')}
            className="hover:text-zinc-300 flex items-center space-x-1 transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Cookies</span>
          </button>
          <span>•</span>
          <button
            onClick={() => setModalLegal('terms')}
            className="hover:text-zinc-300 flex items-center space-x-1 transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Términos</span>
          </button>
          <span>•</span>
          <button
            onClick={() => setModalLegal('delivery')}
            className="hover:text-zinc-300 flex items-center space-x-1 transition-all"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Delivery</span>
          </button>
          <span>•</span>
          <button
            onClick={() => setModalLegal('security')}
            className="hover:text-zinc-300 flex items-center space-x-1 transition-all"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Seguridad</span>
          </button>
          <span>•</span>
          <button
            onClick={() => setModalLegal('contact')}
            className="hover:text-zinc-300 flex items-center space-x-1 transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Contacto</span>
          </button>
        </div>
        <p className="text-[10px] text-zinc-600">
          © {new Date().getFullYear()} Tiquea. Todos los derechos reservados.
        </p>
      </footer>

      {/* MODALES LEGALES */}
      {modalLegal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-lg w-full space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">
                {modalLegal === 'privacy' && 'Aviso de Privacidad'}
                {modalLegal === 'cookies' && 'Política de Cookies'}
                {modalLegal === 'terms' && 'Términos y Condiciones'}
                {modalLegal === 'delivery' && 'Política de Delivery'}
                {modalLegal === 'security' && 'Política de Seguridad'}
                {modalLegal === 'contact' && 'Contacto y Derechos ARCO'}
              </h2>
              <button
                onClick={() => setModalLegal(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalLegal === 'privacy' && (
              <div className="text-xs text-zinc-400 space-y-3 leading-relaxed">
                <p>
                  <strong>Tiquea</strong> respeta la privacidad de sus usuarios. Este Aviso de Privacidad describe qué datos personales recopilamos, para qué los utilizamos y cómo los protegemos.
                </p>
                <p>
                  Podemos recopilar nombre, correo, teléfono, información de uso, historial dentro de la aplicación, datos técnicos como IP, navegador, sistema operativo, ubicación aproximada si la app lo requiere y datos de pago o facturación cuando se utilizan servicios de cobro.
                </p>
                <p>
                  Los datos se utilizan para operar la aplicación, mantener la cuenta, atender soporte, procesar pagos, mejorar la experiencia, cumplir obligaciones legales, prevenir fraudes y ofrecer comunicaciones vinculadas al servicio.
                </p>
                <p>
                  Nunca venderemos tus datos personales. Solo los compartiremos con proveedores de servicios necesarios para funcionamiento, analítica, pagos, almacenamiento, atención al cliente y cumplimiento legal, siempre bajo medidas razonables de protección.
                </p>
                <p>
                  El usuario podrá ejercer sus derechos de acceso, rectificación, cancelación y oposición (ARCO) enviando solicitud a <strong>hola@tiquea.app</strong> o a través del contacto disponible en la web.
                </p>
                <p>
                  Las imágenes de recibos o tickets que se carguen al sistema se procesan únicamente para la extracción de información y no se conservan como archivo permanente si no es necesario para ofrecer el servicio. Las credenciales y datos sensibles se protegen con cifrado y controles de seguridad.
                </p>
                <p>
                  Podemos actualizar este aviso en cualquier momento. Los cambios relevantes se publicarán en esta misma sección y se indicará la fecha de actualización.
                </p>
              </div>
            )}

            {modalLegal === 'cookies' && (
              <div className="text-xs text-zinc-400 space-y-3 leading-relaxed">
                <p>
                  Nuestra web utiliza cookies y tecnologías similares para mejorar la navegación, recordar preferencias, ofrecer una experiencia más útil y analizar el uso del sitio. Las cookies necesarias permiten el correcto funcionamiento de la app.
                </p>
                <p>
                  También podemos usar cookies analíticas y de terceros para medir tráfico, rendimiento, campañas publicitarias y comportamiento general. Antes de activar cookies no esenciales, se solicitará el consentimiento explícito del usuario.
                </p>
                <p>
                  El usuario puede aceptar, rechazar o configurar sus preferencias desde el banner de cookies o desde la configuración del navegador. La desactivación de cookies puede afectar funciones como analítica, personalización y seguridad.
                </p>
                <p>
                  Los terceros que puedan utilizar cookies incluyen proveedores de análisis, publicidad, pagos y servicios de infraestructura. Sus políticas de privacidad pueden aplicarse de forma independiente a la de Tiquea.
                </p>
              </div>
            )}

            {modalLegal === 'terms' && (
              <div className="text-xs text-zinc-400 space-y-3 leading-relaxed">
                <p>
                  Al usar Tiquea, el usuario acepta que la plataforma es una herramienta para calcular, dividir y gestionar cuentas entre personas, con apoyo de funciones de IA para reconocer información de recibos o tickets. El servicio se brinda con fines informativos y de apoyo operativo.
                </p>
                <p>
                  El usuario es responsable de la información que ingrese, de verificar los resultados antes de compartirlos, aceptarlos o utilizarlos para realizar pagos. Los cálculos, sugerencias o resultados generados por IA pueden contener errores o variaciones y deben revisarse antes de tomar decisiones importantes.
                </p>
                <p>
                  No está permitido utilizar la plataforma para actividades ilegales, fraudulentas, maliciosas, ofensivas, relacionadas con contenido no autorizado o que viole derechos de terceros. Tiquea puede restringir, suspender o eliminar cuentas o contenido que incumplan estas reglas.
                </p>
                <p>
                  Tiquea, su diseño, logotipos, textos, código y contenido asociado son propiedad de la marca o de sus licenciatarios. Queda prohibida la reproducción, distribución o uso no autorizado de estos elementos.
                </p>
                <p>
                  Tiquea no garantiza disponibilidad ininterrumpida del servicio ni ausencia total de errores. En la medida permitida por la ley, la plataforma no será responsable por daños indirectos, incidentales, consecuentes o pérdida de datos derivados del uso del servicio, salvo que exista obligación legal expresa.
                </p>
              </div>
            )}

            {modalLegal === 'delivery' && (
              <div className="text-xs text-zinc-400 space-y-3 leading-relaxed">
                <p>
                  Si Tiquea ofrece servicios de entrega, delivery o envío asociado a algún producto o servicio, esta política aplica a los pedidos o solicitudes realizadas a través de la plataforma.
                </p>
                <p>
                  Los tiempos de entrega son estimados y pueden variar por tráfico, logística, disponibilidad del proveedor, condiciones climáticas, cierres temporales o eventos ajenos al control de Tiquea. La confirmación del pedido no garantiza una entrega exacta a la hora indicada.
                </p>
                <p>
                  Los costos, zonas de cobertura, tiempos y métodos de pago se informarán claramente antes de confirmar la operación. En caso de cancelación, devolución o cambio, se aplicará la política vigente y los términos del proveedor o del servicio correspondiente.
                </p>
                <p>
                  El usuario deberá proporcionar datos completos y correctos para la entrega, incluyendo dirección, referencias y contacto. Tiquea no será responsable por retrasos o errores cuando la información proporcionada por el cliente sea incompleta o incorrecta.
                </p>
                <p>
                  En caso de incidentes con entregas, daños, retrasos o productos no conformes, el cliente puede comunicarlo a <strong>hola@tiquea.app</strong> para revisión y atención.
                </p>
              </div>
            )}

            {modalLegal === 'security' && (
              <div className="text-xs text-zinc-400 space-y-3 leading-relaxed">
                <p>
                  La seguridad de la información es prioridad para Tiquea. Implementamos medidas razonables de seguridad técnica, administrativa y física para proteger el acceso a los datos y prevenir uso indebido, robo, pérdida o alteración.
                </p>
                <p>
                  Entre estas medidas se encuentran cifrado de credenciales y tráfico en tránsito, controles de acceso, respaldo de datos, registro de auditoría, mitigación de vulnerabilidades y buenas prácticas de desarrollo seguro.
                </p>
                <p>
                  Sin embargo, ninguna plataforma o sistema online garantiza seguridad absoluta. El usuario también debe proteger sus contraseñas, no compartir credenciales y mantener actualizado su dispositivo y navegador.
                </p>
                <p>
                  En caso de detectar un incidente de seguridad, Tiquea realizará la revisión y notificación según la legislación aplicable y las mejores prácticas de protección de datos.
                </p>
              </div>
            )}

            {modalLegal === 'contact' && (
              <div className="text-xs text-zinc-400 space-y-3 leading-relaxed">
                <p>
                  Para ejercer sus derechos de acceso, rectificación, cancelación, oposición, transparencia, portabilidad o cualquier consulta relacionada con privacidad, seguridad, cookies o uso del servicio, puede contactarnos en:
                </p>
                <p>
                  <strong>Correo:</strong> hola@tiquea.app
                </p>
                <p>
                  <strong>Teléfono:</strong> +52 55 0000 0000
                </p>
                <p>
                  <strong>Sitio:</strong> https://tiquea.app
                </p>
                <p>
                  Las solicitudes serán atendidas en los plazos legales que correspondan y, en su caso, se requerirá información adicional para verificar la identidad del solicitante.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <AdBanner enabled={settings.adsEnabled} />
    </div>
  );
}