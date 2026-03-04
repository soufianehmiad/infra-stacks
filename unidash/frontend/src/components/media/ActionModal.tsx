import { useState } from 'react';
import { mediaApi } from '../../lib/media-api';
import type { MediaFile } from '../../types/media';

const ACTIONS = [
  { id: 'reencode', label: 'Re-encode', sub: 'H.264 VAAPI QP26 \u00b7 auto-revert if larger' },
  { id: 'remux', label: 'Remux', sub: 'Copy video stream \u00b7 AAC 192k audio' },
  { id: 'downscale', label: 'Downscale', sub: 'Scale to 1080p H.264 VAAPI' },
  { id: 'delete', label: 'Delete', sub: 'Permanently remove from disk' },
  { id: 'skip', label: 'Skip', sub: 'No action \u2014 dismiss' },
];

interface ActionModalProps {
  file: MediaFile;
  onClose: () => void;
  onDone: (type: string) => void;
}

export default function ActionModal({ file, onClose, onDone }: ActionModalProps) {
  const [action, setAction] = useState(file.suggested_action || 'skip');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (action === 'skip') {
      onClose();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (action === 'delete') {
        await mediaApi.deleteFile(file.id);
        onDone('deleted');
      } else {
        await mediaApi.createJob(file.id, action);
        onDone('queued');
      }
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const isDanger = action === 'delete';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[420px] border-[2px] border-zinc-700 bg-zinc-900 shadow-[6px_6px_0_#000]">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b-[2px] border-zinc-700">
          <p className="text-[10px] font-mono font-black uppercase tracking-widest text-zinc-500 mb-1">Select action</p>
          <h2 className="text-[15px] font-bold text-zinc-100 truncate">{file.filename}</h2>
          <p className="text-[11px] font-mono text-zinc-500 mt-0.5 truncate">{file.path}</p>
        </div>

        {/* Options */}
        <div className="p-4 flex flex-col gap-1">
          {ACTIONS.map((a) => (
            <label
              key={a.id}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border transition-colors ${
                action === a.id
                  ? 'bg-brutalist-accent/10 border-brutalist-accent'
                  : 'border-transparent hover:bg-zinc-800/50'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 ${
                  action === a.id ? 'border-brutalist-accent' : 'border-zinc-600'
                }`}
              >
                {action === a.id && <div className="w-1.5 h-1.5 rounded-full bg-brutalist-accent" />}
              </div>
              <input type="radio" name="action" value={a.id} checked={action === a.id} onChange={() => setAction(a.id)} className="hidden" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[13px] ${action === a.id ? 'text-zinc-100 font-semibold' : 'text-zinc-400'}`}>{a.label}</span>
                  {a.id === file.suggested_action && (
                    <span className="text-[9px] font-mono font-bold text-brutalist-accent uppercase tracking-wider">suggested</span>
                  )}
                </div>
                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{a.sub}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-3 px-3 py-2 text-[11px] font-mono text-red-400 bg-red-500/10 border border-red-500/30">{error}</div>
        )}

        {/* Footer */}
        <div className="px-4 pb-4 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-bold text-zinc-400 bg-zinc-800 border-[2px] border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`px-5 py-2 text-[12px] font-black uppercase tracking-wider border-[2px] border-black shadow-[3px_3px_0_#000] transition-all active:shadow-none active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 ${
              isDanger
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-brutalist-accent text-black hover:brightness-110'
            }`}
          >
            {loading ? 'Working\u2026' : action === 'skip' ? 'Dismiss' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
