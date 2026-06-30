/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldAlert, Fingerprint, Lock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Contract } from '../types';
import { RISK_REGISTRY, HIGH_RISK_THRESHOLD } from '../lib/constants';
import { motion } from 'motion/react';

interface BoundaryContractProps {
  contract: Contract | null;
  status: string; // 'signed' or 'pending' or 'empty'
}

export default function BoundaryContract({ contract, status }: BoundaryContractProps) {
  const isSigned = status === 'signed' && contract;

  // Render a list of key tools and their risk scores
  const allCoreTools = [
    { name: 'read_codebase', label: 'Read Codebase' },
    { name: 'modify_auth_module', label: 'Modify Authentication Module' },
    { name: 'run_tests', label: 'Run Tests' },
    { name: 'deploy_staging', label: 'Deploy to Staging' }
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 backdrop-blur-sm shadow-xl flex flex-col h-full" id="panel-boundary-contract">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3.5">
        <div className="flex items-center space-x-2">
          <Fingerprint className="h-4 w-4 text-emerald-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-300">
            Boundary Contract
          </h2>
        </div>
        <div>
          {isSigned ? (
            <span className="flex items-center space-x-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold font-mono tracking-wider text-emerald-400 uppercase" id="contract-badge-verified">
              <ShieldCheck className="h-3 w-3" />
              <span>Verified</span>
            </span>
          ) : (
            <span className="rounded-full bg-zinc-900 border border-zinc-700 px-2.5 py-0.5 text-[10px] font-bold font-mono tracking-wider text-zinc-500 uppercase" id="contract-badge-awaiting">
              Awaiting Intent
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-4 flex-grow">


        {/* Authorized Tools Tags (Direct matches the image) */}
        <div>
          <label className="block font-mono text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5">
            Authorized Tools / Tags
          </label>
          <div className="flex flex-wrap gap-1.5 min-h-[34px] p-2 rounded-lg border border-zinc-900 bg-black/30">
            {isSigned && contract.allowed_actions.length > 0 ? (
              contract.allowed_actions.map((tool) => (
                <span
                  key={tool}
                  className="px-2 py-0.5 rounded bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 font-mono text-[10px] tracking-wider font-semibold uppercase"
                  id={`tag-tool-${tool}`}
                >
                  {tool}
                </span>
              ))
            ) : (
              <span className="font-mono text-[10px] text-zinc-700 italic px-1">
                No tools registered. Enter goals and generate intent above.
              </span>
            )}
          </div>
        </div>

        {/* Allowed Actions Registry with animated bars */}
        <div className="border-t border-zinc-900 pt-3">
          <label className="block font-mono text-[10px] text-zinc-500 uppercase tracking-widest mb-2.5">
            Boundary Policies & Risk Evaluation
          </label>
          
          <div className="space-y-2.5">
            {allCoreTools.map((tool) => {
              const score = RISK_REGISTRY[tool.name] || 1;
              const isAllowed = isSigned && contract.allowed_actions.includes(tool.name);
              const scorePercentage = (score / 10) * 100;
              
              return (
                <div
                  key={tool.name}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    isAllowed
                      ? 'border-emerald-900/30 bg-emerald-950/5'
                      : 'border-zinc-900 bg-zinc-900/10'
                  }`}
                  id={`policy-item-${tool.name}`}
                >
                  <div className="flex items-center justify-between font-mono text-xs mb-1.5">
                    <span className={isAllowed ? 'text-zinc-300 font-semibold' : 'text-zinc-500'}>
                      {tool.label}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        isAllowed
                          ? 'bg-emerald-950/50 border border-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                      }`}>
                        {isAllowed ? 'Allowed' : 'Locked'}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-bold">
                        Risk: {score}/10
                      </span>
                    </div>
                  </div>

                  {/* Progress Risk Bar */}
                  <div className="w-full bg-zinc-900 rounded-full h-1 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${scorePercentage}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={`h-full ${
                        score >= HIGH_RISK_THRESHOLD
                          ? 'bg-rose-500'
                          : score >= 4
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
