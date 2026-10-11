import React, { useState } from 'react';
import type { Tip } from '../app/types';

interface TipSelectorProps {
  tip: Tip;
  onChange: (newTip: Tip) => void;
}

export const TipSelector: React.FC<TipSelectorProps> = ({ tip, onChange }) => {
  const presets = [0, 10, 15, 20];
  const isPreset = presets.includes(tip.value);
  const [isCustom, setIsCustom] = useState<boolean>(!isPreset);
  const [customInput, setCustomInput] = useState<string>(
    !isPreset ? tip.value.toString() : ''
  );

  const handlePresetClick = (pct: number) => {
    setIsCustom(false);
    setCustomInput('');
    onChange({ type: 'percentage', value: pct });
  };

  const handleCustomClick = () => {
    setIsCustom(true);
    setCustomInput('');
    onChange({ type: 'percentage', value: 0 });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setCustomInput(valStr);

    if (valStr === '') {
      onChange({ type: 'percentage', value: 0 });
      return;
    }

    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange({ type: 'percentage', value: parsed });
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Propina (%)
      </label>
      <div className="grid grid-cols-5 gap-2">
        {presets.map((pct) => (
          <button
            key={pct}
            type="button"
            onClick={() => handlePresetClick(pct)}
            className={`py-3 rounded-2xl text-xs font-bold transition-all ${
              !isCustom && tip.value === pct
                ? 'bg-white text-black shadow-lg'
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {pct}%
          </button>
        ))}
        <button
          type="button"
          onClick={handleCustomClick}
          className={`py-3 rounded-2xl text-xs font-bold transition-all ${
            isCustom
              ? 'bg-white text-black shadow-lg'
              : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          Otro
        </button>
      </div>

      {isCustom && (
        <div className="pt-1">
          <div className="relative flex items-center">
            <input
              type="number"
              min="0"
              step="any"
              value={customInput}
              onChange={handleInputChange}
              placeholder="Escribe el porcentaje (ej. 12)"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none pr-10"
            />
            <span className="absolute right-4 text-zinc-400 font-bold text-sm">
              %
            </span>
          </div>
        </div>
      )}
    </div>
  );
};