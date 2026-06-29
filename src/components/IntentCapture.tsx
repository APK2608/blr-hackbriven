/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, Terminal, Keyboard } from 'lucide-react';
import { SAMPLE_GOALS } from '../lib/constants';

interface IntentCaptureProps {
  onGenerate: (goal: string) => void;
  isLoading: boolean;
}

export default function IntentCapture({ onGenerate, isLoading }: IntentCaptureProps) {
  const [goal, setGoal] = useState('Fix the login authentication bug in our application.');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal.trim()) {
      onGenerate(goal.trim());
    }
  };

  const selectPreset = (preset: string) => {
    setGoal(preset);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 backdrop-blur-sm shadow-xl flex flex-col h-full" id="panel-intent-capture">
      <div className="flex items-center space-x-2 border-b border-zinc-900 pb-3.5">
        <Terminal className="h-4 w-4 text-emerald-400" />
        <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-300">
          Intent Capture
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col flex-grow justify-between space-y-4">
        <div className="space-y-3">
          <label className="font-mono text-[11px] text-zinc-500 uppercase tracking-widest flex items-center justify-between">
            <span>Describe Agent Mission / Scope</span>
            <span className="flex items-center gap-1">
              <Keyboard className="h-3 w-3" /> UTF-8
            </span>
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe the goal... e.g. 'Analyze threat vectors from 192.168.1.0/24 subnet'"
            rows={4}
            className="w-full rounded-lg border border-zinc-800 bg-black p-3.5 font-mono text-xs text-zinc-300 placeholder-zinc-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all resize-none"
            id="input-intent-goal"
            disabled={isLoading}
          />
          
          {/* Quick presets for swift demoing */}
          <div className="space-y-1.5">
            <span className="font-mono text-[10px] text-zinc-600 block uppercase tracking-wider">Demo Presets:</span>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_GOALS.map((preset, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => selectPreset(preset)}
                  className={`px-2 py-1 rounded font-mono text-[10px] border transition-all text-left ${
                    goal === preset
                      ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                      : 'border-zinc-800/60 bg-zinc-900/30 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                  }`}
                  id={`btn-preset-${index}`}
                >
                  {preset.length > 55 ? `${preset.substring(0, 52)}...` : preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !goal.trim()}
          className={`w-full mt-4 flex items-center justify-center space-x-2 py-3 rounded-lg border font-mono text-xs font-semibold tracking-wider uppercase transition-all duration-300 shadow-md ${
            isLoading
              ? 'border-zinc-800 bg-zinc-900/30 text-zinc-500 cursor-not-allowed'
              : 'border-emerald-500/40 bg-emerald-950/10 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-400 cursor-pointer active:scale-[0.99]'
          }`}
          id="btn-generate-cryptographic-intent"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Signing Contract...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Generate Cryptographic Intent</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
