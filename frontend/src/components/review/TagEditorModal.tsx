import { useState } from 'react';
import type { TagEditorModalProps } from './types';
import { TAG_CATEGORIES } from '../../types/transactions';
import { getTagColor } from '../../utils/transactionParser';

export function TagEditorModal({ transaction, onSave, onClose }: TagEditorModalProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([...transaction.tags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed inset-x-4 top-[10%] mx-auto max-w-sm z-[70] bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bw-100">
          <div>
            <h3 className="text-sm font-semibold text-bw-900">Edit Tags</h3>
            <p className="text-xs text-bw-400 mt-0.5 truncate max-w-[200px]">{transaction.payee}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-bw-400 hover:text-bw-900 hover:bg-bw-50 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {TAG_CATEGORIES.map(cat => (
            <div key={cat.name}>
              <p className="text-[10px] font-semibold text-bw-400 uppercase tracking-widest mb-2">{cat.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {cat.tags.map(tag => {
                  const active = selectedTags.includes(tag);
                  const colors = getTagColor(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        active
                          ? `${colors.bg} ${colors.text} ${colors.border}`
                          : 'bg-white text-bw-400 border-bw-200 hover:border-bw-300'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-bw-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-bw-600 bg-bw-50 rounded-lg hover:bg-bw-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(selectedTags); onClose(); }}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-bw-900 rounded-lg hover:bg-bw-800 transition-colors"
          >
            Save Tags
          </button>
        </div>
      </div>
    </>
  );
}
