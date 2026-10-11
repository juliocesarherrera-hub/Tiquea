import { useState, useEffect } from 'react';
import type { Settings, Screen, PersonResult, ReceiptItem, Tip } from './app/types';
import { loadSettings, saveSettings } from './services/storage';
import { calculateQuickBill, calculateDetailedBill } from './domain/calculations';
import { shareWhatsApp } from './domain/whatsapp';
import { formatCurrency } from './domain/money';
import { TipSelector } from './components/TipSelector';
import { AdBanner } from './components/AdBanner';
import { scanReceiptWithAI } from './services/ai';
import { Calculator, Sparkles, Camera, ArrowLeft, Settings as SettingsIcon, CheckCircle2, Share2, RefreshCw, Plus, Trash2, X } from 'lucide-react';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [settings, setSettings] = useState<Settings>(() => ({
    ...loadSettings(),
    provider: 'gemini',
  }));

  // Origen del escaneo (si viene de modo rápido o detallado)
  const [scanSource, setScanSource] = useState<'quick' | 'detailed'>('detailed');

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
  }, [settings]);

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

    setLoadingScan(true);
    setScanError('');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await scanReceiptWithAI('gemini', settings.apiKey, base64);

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
        setLoadingScan(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Error al procesar la imagen.');
      setLoadingScan(false);
    }
  };

  return (
    <div className="bg-black min-h-screen text-white font-sans selection:bg-emerald-500 selection:text-black pb-24">
      {/* 1. HOME SCREEN */}
      {screen === 'home' && (
        <main className="max-w-md mx-auto p-6 space-y-8 pt-10">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-black tracking-tight text-emerald-400">
              Tiquea
            </span>
            <button
              onClick={() => setScreen('settings')}
              className="p-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
              Divide tu cuenta <span className="text-emerald-400">sin peleas.</span>
            </h1>
            <p className="text-xs text-zinc-400">
              Escanea tu ticket con IA o divide los gastos entre amigos en segundos.
            </p>
          </div>

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
                <div className="text-xs text-zinc-400">Escanea el ticket con IA y asigna platillos.</div>
              </div>
            </button>
          </div>
        </main>
      )}

      {/* 2. CONFIGURACIÓN */}
      {screen === 'settings' && (
        <main className="max-w-md mx-auto p-6 space-y-6 pt-6">
          <button onClick={() => setScreen('home')} className="flex items-center text-zinc-400 text-sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Regresar
          </button>
          <h1 className="text-2xl font-bold">Configuración</h1>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase block">
                Gemini API Key
              </label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, provider: 'gemini', apiKey: e.target.value })}
                placeholder="Pega tu clave de Google AI Studio aquí..."
                className="w-full bg-black border border-zinc-800 rounded-2xl p-3.5 text-xs text-white font-mono"
              />
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Tu clave debe empezar por "AQ.".
            </p>
          </div>
        </main>
      )}

      {/* 3. MODO RÁPIDO */}
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
              setResults(res);
              setScreen('results');
            }}
            className="w-full py-4 rounded-2xl bg-white text-black font-extrabold text-base hover:bg-zinc-200 transition-all"
          >
            Calcular Total
          </button>
        </main>
      )}

      {/* 4. MODO DETALLADO */}
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

          {/* Comensales */}
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

          {/* Artículos */}
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
                      {/* Botón "Todos" */}
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

                      {/* Botones individuales */}
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
              setResults(res);
              setScreen('results');
            }}
            className="w-full py-4 rounded-2xl bg-white text-black font-extrabold text-base hover:bg-zinc-200 transition-all"
          >
            Calcular Cuentas Exactas
          </button>
        </main>
      )}

      {/* 5. ESCÁNER */}
      {screen === 'scanner' && (
        <main className="max-w-md mx-auto p-6 space-y-6 pt-6 text-center">
          <button onClick={() => setScreen(scanSource)} className="flex items-center text-zinc-400 text-sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Cancelar
          </button>
          <h1 className="text-2xl font-bold">Escáner de Ticket</h1>

          {scanError && <div className="p-4 bg-rose-500/20 text-rose-300 text-xs rounded-2xl text-left">{scanError}</div>}

          <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-4">
            <Camera className="w-12 h-12 mx-auto text-violet-400" />
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="ticket-file" />
            <label
              htmlFor="ticket-file"
              className="block w-full py-4 rounded-2xl bg-white text-black font-bold text-sm cursor-pointer hover:bg-zinc-200 transition-all"
            >
              {loadingScan ? 'Analizando Ticket...' : 'Subir o Tomar Foto'}
            </label>
          </div>
        </main>
      )}

      {/* 6. RESULTADOS */}
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

          <button
            onClick={() => shareWhatsApp(results)}
            className="w-full py-4 rounded-2xl bg-emerald-500 text-black font-extrabold flex items-center justify-center space-x-2 hover:bg-emerald-400 transition-all"
          >
            <Share2 className="w-5 h-5" />
            <span>Compartir por WhatsApp</span>
          </button>

          <button
            onClick={resetAll}
            className="w-full py-3 rounded-2xl bg-zinc-900 text-zinc-300 font-bold flex items-center justify-center space-x-2 hover:bg-zinc-800 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Nueva Cuenta</span>
          </button>
        </main>
      )}

      <AdBanner enabled={settings.adsEnabled} />
    </div>
  );
}