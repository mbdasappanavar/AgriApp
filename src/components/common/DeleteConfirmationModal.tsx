import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Check, ShieldAlert, Layers } from 'lucide-react';

export interface RelatedDataCleanupItem {
  label: string;
  description: string;
  count?: number | string;
}

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  itemName: string;
  itemType: string;
  itemCode?: string;
  relatedData?: RelatedDataCleanupItem[];
  warningMessage?: string;
  requireTypingConfirm?: boolean;
  confirmWord?: string;
  isDeleting?: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  itemType,
  itemCode,
  relatedData = [],
  warningMessage,
  requireTypingConfirm = false,
  confirmWord = 'DELETE',
  isDeleting = false
}) => {
  const [typedInput, setTypedInput] = useState('');
  const [confirmedCheck, setConfirmedCheck] = useState(false);

  if (!isOpen) return null;

  const canConfirm = requireTypingConfirm
    ? typedInput.trim().toUpperCase() === confirmWord.toUpperCase()
    : confirmedCheck;

  const handleConfirm = async () => {
    if (!canConfirm || isDeleting) return;
    await onConfirm();
    setTypedInput('');
    setConfirmedCheck(false);
  };

  const handleCancel = () => {
    if (isDeleting) return;
    setTypedInput('');
    setConfirmedCheck(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-rose-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-rose-950/40 border-b border-rose-900/40 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">{title}</h3>
              <p className="text-xs text-rose-300 font-medium">Permanent Data Deletion & Cascade Cleanup</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            disabled={isDeleting}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Target Item Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="uppercase font-semibold tracking-wider text-[10px] text-slate-400">{itemType} to be deleted</span>
              {itemCode && <span className="font-mono text-slate-400">Code: {itemCode}</span>}
            </div>
            <div className="text-base font-bold text-slate-100 break-words">
              {itemName}
            </div>
          </div>

          {/* Warning Banner */}
          <div className="flex items-start space-x-3 bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl text-xs text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <span className="font-bold text-amber-300">Warning: This action cannot be undone.</span>
              <p className="text-amber-200/90">
                {warningMessage || 'Deleting this item will permanently purge it and safely clean up all linked child records, ledger entries, and transaction references to maintain database integrity.'}
              </p>
            </div>
          </div>

          {/* Cascading Related Data Cleanup List */}
          {relatedData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Corresponding related data to be cleaned:</span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl divide-y divide-slate-800/60 overflow-hidden text-xs">
                {relatedData.map((rel, idx) => (
                  <div key={idx} className="p-3 flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-medium text-slate-200">{rel.label}</div>
                      <div className="text-[11px] text-slate-400">{rel.description}</div>
                    </div>
                    {rel.count !== undefined && (
                      <span className="px-2 py-0.5 bg-rose-500/15 text-rose-400 border border-rose-500/20 rounded-md text-[10px] font-mono font-bold shrink-0">
                        {rel.count}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explicit User Confirmation */}
          {requireTypingConfirm ? (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-medium text-slate-300 block">
                Type <strong className="text-rose-400 font-mono">{confirmWord}</strong> below to confirm deletion:
              </label>
              <input
                type="text"
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                placeholder={`Type ${confirmWord}`}
                className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
              />
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-start space-x-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmedCheck}
                  onChange={(e) => setConfirmedCheck(e.target.checked)}
                  className="mt-0.5 rounded bg-slate-950 border-slate-700 text-rose-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-slate-300 leading-snug">
                  I understand that deleting <strong className="text-slate-100">{itemName}</strong> will permanently remove all associated relational data from the database.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || isDeleting}
            className={`flex items-center space-x-2 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-lg transition-all ${
              canConfirm && !isDeleting
                ? 'bg-rose-600 hover:bg-rose-500 cursor-pointer shadow-rose-900/30'
                : 'bg-rose-950/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
            }`}
          >
            <Trash2 className={`w-3.5 h-3.5 ${isDeleting ? 'animate-spin' : ''}`} />
            <span>{isDeleting ? 'Cleaning & Deleting...' : 'Confirm & Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
