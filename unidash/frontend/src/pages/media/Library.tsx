import { useEffect, useState, useCallback, useRef } from 'react';
import { mediaApi, fmtBytes, fmtDuration } from '../../lib/media-api';
import ActionModal from '../../components/media/ActionModal';
import type { MediaFile } from '../../types/media';

const PAGE_SIZE = 100;
const FOLDER_TABS = ['all', 'movies', 'series', 'anime', 'downloads'];
const GRID = '36px 1fr 90px 72px 64px 82px 108px 90px 78px';

const CODEC_OPTIONS = [
  { v: 'hevc', l: 'H.265' },
  { v: 'avc', l: 'H.264' },
  { v: 'av1', l: 'AV1' },
];
const RES_OPTIONS = [
  { v: '4K', l: '4K' },
  { v: '1080p', l: '1080p' },
  { v: '720p', l: '720p' },
];
const AUDIO_OPTIONS = [
  { v: 'AAC', l: 'AAC' },
  { v: 'EAC3', l: 'EAC3' },
  { v: 'AC3', l: 'AC3' },
  { v: 'TrueHD', l: 'TrueHD' },
  { v: 'DTS', l: 'DTS' },
];
const ACTION_OPTIONS = [
  { v: 'reencode', l: 'Re-encode' },
  { v: 'remux', l: 'Remux' },
  { v: 'downscale', l: 'Downscale' },
  { v: 'skip', l: 'Skip' },
];

const CODEC_MAP: Record<string, { label: string; good: boolean }> = {
  hevc: { label: 'H.265', good: true },
  'h.265': { label: 'H.265', good: true },
  h265: { label: 'H.265', good: true },
  avc: { label: 'H.264', good: false },
  'h.264': { label: 'H.264', good: false },
  h264: { label: 'H.264', good: false },
  av1: { label: 'AV1', good: true },
};
const ACTION_LABEL: Record<string, string> = { reencode: 'Re-encode', remux: 'Remux', downscale: 'Downscale', skip: 'Skip', delete: 'Delete' };

const HEADERS = [
  { label: 'Filename', col: 'filename', align: 'left' as const },
  { label: 'Size', col: 'size_bytes', align: 'right' as const },
  { label: 'Codec', col: 'codec', align: 'left' as const },
  { label: 'Res', col: 'height', align: 'left' as const },
  { label: 'Duration', col: 'duration_s', align: 'left' as const },
  { label: 'Audio', col: 'audio_codec', align: 'left' as const },
  { label: 'Action', col: 'suggested_action', align: 'left' as const },
  { label: '', col: null, align: 'left' as const },
];

interface FilterDropdownProps {
  label: string;
  options: { v: string; l: string }[];
  value: string;
  onChange: (v: string) => void;
}

function FilterDropdown({ label, options, value, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find((o) => o.v === value);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 h-7 text-[11px] border whitespace-nowrap transition-colors ${
          selected
            ? 'bg-brutalist-accent/10 text-brutalist-accent border-brutalist-accent/40'
            : 'bg-black text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200'
        }`}
      >
        <span className="text-[9px] font-mono font-bold tracking-wider uppercase">{label}</span>
        {selected && <span className="w-px h-3 bg-brutalist-accent/30" />}
        <span>{selected ? selected.l : ''}</span>
        {selected ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setOpen(false);
            }}
            className="ml-0.5 text-[13px] leading-none text-brutalist-accent/70 cursor-pointer hover:text-brutalist-accent"
          >
            \u00d7
          </span>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-40">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 z-[100] bg-zinc-800 border-[2px] border-zinc-600 min-w-full overflow-hidden shadow-[4px_4px_0_#000]">
          {options.map((o) => (
            <button
              key={o.v}
              onClick={() => {
                onChange(o.v === value ? '' : o.v);
                setOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 text-[12px] transition-colors ${
                o.v === value
                  ? 'text-brutalist-accent bg-brutalist-accent/10 border-l-2 border-l-brutalist-accent'
                  : 'text-zinc-400 border-l-2 border-l-transparent hover:bg-zinc-700/50 hover:text-zinc-200'
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ScanButton({ status, onScan }: { status: { running: boolean; scanned: number; total: number }; onScan: () => void }) {
  const isRunning = status.running;
  const pct = status.total > 0 ? Math.round((status.scanned / status.total) * 100) : 0;
  return (
    <button
      onClick={onScan}
      disabled={isRunning}
      className={`px-4 py-2 text-[12px] font-black uppercase tracking-wider flex items-center gap-2 border-[2px] border-black shadow-[3px_3px_0_#000] transition-all active:shadow-none active:translate-x-0.5 active:translate-y-0.5 ${
        isRunning
          ? 'bg-zinc-800 text-brutalist-accent border-brutalist-accent/50 cursor-not-allowed shadow-none'
          : 'bg-brutalist-accent text-black hover:brightness-110'
      }`}
    >
      {isRunning ? (
        <>
          <div className="w-1.5 h-1.5 rounded-full bg-brutalist-accent animate-pulse" />
          Scanning {pct}%
        </>
      ) : (
        'Scan Library'
      )}
    </button>
  );
}

export default function MediaLibrary() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState('all');
  const [codec, setCodec] = useState('');
  const [resolution, setResolution] = useState('');
  const [audio, setAudio] = useState('');
  const [suggestedAction, setSuggestedAction] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('size_bytes');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [actionFile, setActionFile] = useState<MediaFile | null>(null);
  const [scanStatus, setScanStatus] = useState({ running: false, scanned: 0, total: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [folder, codec, resolution, audio, debouncedSearch, suggestedAction, sortBy, sortDir]);

  const load = useCallback(async () => {
    try {
      const data = await mediaApi.files({
        folder,
        codec,
        resolution,
        audio,
        search: debouncedSearch,
        suggested_action: suggestedAction,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      setFiles(data.items);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [folder, codec, resolution, audio, debouncedSearch, suggestedAction, page, sortBy, sortDir]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const poll = async () => {
      try {
        setScanStatus(await mediaApi.scanStatus());
      } catch {}
    };
    poll();
    const t = setInterval(poll, scanStatus.running ? 1000 : 5000);
    return () => clearInterval(t);
  }, [scanStatus.running]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }
  async function handleScan() {
    await mediaApi.startScan();
    notify('Scan started');
  }

  function toggleSelect(id: number, checked: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      checked ? n.add(id) : n.delete(id);
      return n;
    });
  }
  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(files.map((f) => f.id)) : new Set());
  }

  async function executeBulkAction(action: string) {
    const ids = Array.from(selected);
    let ok = 0,
      fail = 0;
    for (const id of ids) {
      try {
        action === 'delete' ? await mediaApi.deleteFile(id) : await mediaApi.createJob(id, action);
        ok++;
      } catch {
        fail++;
      }
    }
    setSelected(new Set());
    setConfirmDelete(null);
    notify(fail > 0 ? `${ok} done, ${fail} failed` : `${ok} items \u2192 ${action}`);
    load();
  }

  function handleBulkAction(action: string) {
    action === 'delete' ? setConfirmDelete(selected.size) : executeBulkAction(action);
  }

  function onActionDone(type: string) {
    notify(type === 'deleted' ? 'File deleted' : 'Job queued');
    load();
  }

  function clearFilters() {
    setCodec('');
    setResolution('');
    setAudio('');
    setSuggestedAction('');
    setSearch('');
  }

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  }

  const allSelected = files.length > 0 && selected.size === files.length;
  const hasFilters = codec || resolution || audio || suggestedAction || debouncedSearch;

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-200px)] overflow-hidden">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-black uppercase tracking-tight text-zinc-100 leading-none">Library</h1>
          <p className="text-[11px] font-mono text-zinc-500 mt-1">{loading ? '\u2014' : `${total.toLocaleString()} files`}</p>
        </div>
        <ScanButton status={scanStatus} onScan={handleScan} />
      </div>

      {/* Toast */}
      {toast && (
        <div className="px-3 py-2 text-[11px] font-mono text-brutalist-accent bg-brutalist-accent/10 border border-brutalist-accent/30">
          {toast}
        </div>
      )}

      {/* Bulk delete confirm */}
      {confirmDelete != null && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border-[2px] border-red-500/50">
          <span className="text-[13px] text-red-400">
            Permanently delete {confirmDelete} file{confirmDelete !== 1 ? 's' : ''} from disk?
          </span>
          <button
            onClick={() => executeBulkAction('delete')}
            className="px-3 py-1 text-[12px] font-bold text-white bg-red-600 border-[2px] border-black shadow-[2px_2px_0_#000] hover:bg-red-500"
          >
            Delete
          </button>
          <button onClick={() => setConfirmDelete(null)} className="px-3 py-1 text-[12px] text-zinc-400 border border-zinc-700 hover:text-zinc-200">
            Cancel
          </button>
        </div>
      )}

      {/* Filter panel */}
      <div className="border-[2px] border-zinc-700 bg-zinc-900 shadow-[4px_4px_0_#000]">
        {/* Folder tabs + Search */}
        <div className="flex items-stretch border-b-[2px] border-zinc-700">
          {FOLDER_TABS.map((f) => (
            <button
              key={f}
              onClick={() => setFolder(f)}
              className={`px-4 h-[38px] text-[12px] capitalize shrink-0 transition-colors border-b-2 ${
                folder === f
                  ? 'text-brutalist-accent font-bold border-b-brutalist-accent'
                  : 'text-zinc-500 border-b-transparent hover:text-zinc-300'
              }`}
            >
              {f}
            </button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center gap-2 px-3 border-l-[2px] border-zinc-700">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`shrink-0 transition-colors ${search ? 'text-brutalist-accent' : 'text-zinc-500'}`}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search files\u2026"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[180px] bg-transparent border-none outline-none text-[12px] text-zinc-200 placeholder:text-zinc-600"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-zinc-500 hover:text-zinc-300 text-[16px] leading-none">
                \u00d7
              </button>
            )}
          </div>
        </div>

        {/* Filter dropdowns */}
        <div className="flex items-center px-3 h-[46px] gap-2">
          <FilterDropdown label="Codec" options={CODEC_OPTIONS} value={codec} onChange={setCodec} />
          <FilterDropdown label="Res" options={RES_OPTIONS} value={resolution} onChange={setResolution} />
          <FilterDropdown label="Audio" options={AUDIO_OPTIONS} value={audio} onChange={setAudio} />
          <FilterDropdown label="Action" options={ACTION_OPTIONS} value={suggestedAction} onChange={setSuggestedAction} />
          {hasFilters && (
            <>
              <div className="flex-1" />
              <button
                onClick={clearFilters}
                className="px-2 py-0.5 text-[10px] font-mono text-zinc-500 border border-zinc-700 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
              >
                clear all
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-brutalist-accent/10 border border-brutalist-accent/30">
          <span className="text-[11px] font-mono text-brutalist-accent">{selected.size} selected</span>
          <div className="w-px h-4 bg-brutalist-accent/30" />
          {[
            { id: 'reencode', label: 'Re-encode' },
            { id: 'remux', label: 'Remux' },
            { id: 'downscale', label: 'Downscale' },
            { id: 'delete', label: 'Delete' },
          ].map((a) => (
            <button
              key={a.id}
              onClick={() => handleBulkAction(a.id)}
              className={`px-3 py-1 text-[11px] border transition-colors ${
                a.id === 'delete'
                  ? 'text-red-400 border-red-400/30 hover:border-red-400'
                  : 'text-zinc-400 border-zinc-700 hover:text-brutalist-accent hover:border-brutalist-accent/50'
              }`}
            >
              {a.label}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[11px] text-zinc-500 hover:text-zinc-300">
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-brutalist-accent animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-[16px] font-bold text-zinc-400">{hasFilters ? 'No files match the current filters' : 'No files found'}</p>
          <p className="text-[11px] font-mono text-zinc-500">{hasFilters ? 'Try adjusting or clearing the filters' : 'Run a scan to index the library'}</p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-2 px-4 py-1.5 text-[11px] text-brutalist-accent bg-brutalist-accent/10 border border-brutalist-accent/30 hover:bg-brutalist-accent/20"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="border-[2px] border-zinc-700 overflow-hidden overflow-y-auto flex-1 min-h-0 shadow-[4px_4px_0_#000]">
          {/* Header row */}
          <div
            className="grid bg-zinc-800/50 border-b-[2px] border-zinc-700 sticky top-0 z-[1]"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="py-2.5 px-3 flex items-center">
              <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} className="accent-brutalist-accent" />
            </div>
            {HEADERS.map(({ label, col, align }) => (
              <div
                key={label || '_btn'}
                onClick={col ? () => handleSort(col) : undefined}
                className={`py-2.5 px-3 flex items-center gap-1 text-[10px] font-mono font-black uppercase tracking-[0.12em] select-none ${
                  col ? 'cursor-pointer' : ''
                } ${col && sortBy === col ? 'text-brutalist-accent' : 'text-zinc-500 hover:text-zinc-300'}`}
                style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}
              >
                {label}
                {col && sortBy === col && <span className="text-[10px]">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>}
              </div>
            ))}
          </div>

          {/* Data rows */}
          <div className="bg-zinc-900">
            {files.map((f) => {
              const codecKey = (f.codec || '').toLowerCase();
              const codecMatch = Object.entries(CODEC_MAP).find(([k]) => codecKey.includes(k));
              const codecLabel = codecMatch ? codecMatch[1].label : f.codec;
              const codecGood = codecMatch ? codecMatch[1].good : false;
              const actionLabel = ACTION_LABEL[f.suggested_action] || f.suggested_action;
              const isSkip = f.suggested_action === 'skip';
              const isSelected = selected.has(f.id);

              return (
                <div
                  key={f.id}
                  className={`grid min-w-0 border-b border-zinc-800 transition-colors ${
                    isSelected ? 'bg-brutalist-accent/5' : 'hover:bg-zinc-800/30'
                  }`}
                  style={{ gridTemplateColumns: GRID }}
                >
                  <div className="py-2.5 px-3 flex items-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleSelect(f.id, e.target.checked)}
                      className="accent-brutalist-accent"
                    />
                  </div>
                  <div className="py-2.5 px-3 min-w-0">
                    <div className="text-[13px] text-zinc-200 truncate" title={f.path || f.filename}>
                      {f.filename}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{f.folder}</div>
                  </div>
                  <div className="py-2.5 px-3 flex items-center justify-end">
                    <span className="text-[12px] font-mono text-zinc-400">{fmtBytes(f.size_bytes)}</span>
                  </div>
                  <div className="py-2.5 px-3 flex items-center">
                    <span className={`text-[11px] font-mono ${codecGood ? 'text-emerald-400' : 'text-zinc-400'}`}>{codecLabel}</span>
                  </div>
                  <div className="py-2.5 px-3 flex items-center">
                    <span className="text-[11px] font-mono text-zinc-400">{f.resolution}</span>
                  </div>
                  <div className="py-2.5 px-3 flex items-center">
                    <span className="text-[11px] font-mono text-zinc-500">{fmtDuration(f.duration_s)}</span>
                  </div>
                  <div className="py-2.5 px-3 flex items-center overflow-hidden">
                    <span className="text-[11px] text-zinc-500 truncate" title={f.audio_codec}>
                      {f.audio_codec}
                    </span>
                  </div>
                  <div className="py-2.5 px-3 flex items-center">
                    <span className={`text-[11px] ${isSkip ? 'text-zinc-500' : 'text-brutalist-accent font-medium'}`}>{actionLabel}</span>
                  </div>
                  <div className="py-2.5 px-3 flex items-center">
                    <button
                      onClick={() => setActionFile(f)}
                      className="px-3 py-1 text-[11px] text-zinc-400 bg-zinc-800 border border-zinc-700 hover:border-brutalist-accent hover:text-brutalist-accent transition-colors whitespace-nowrap"
                    >
                      {isSkip ? 'Action' : actionLabel}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between py-2">
          <span className="text-[11px] font-mono text-zinc-500">
            {page * PAGE_SIZE + 1}\u2013{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className={`px-3 py-1 text-[12px] border-[2px] ${
                page === 0
                  ? 'text-zinc-600 border-zinc-800 cursor-not-allowed'
                  : 'text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:border-zinc-500'
              }`}
            >
              \u2190 Prev
            </button>
            <span className="text-[11px] font-mono text-zinc-500 min-w-[80px] text-center">
              {page + 1} / {Math.ceil(total / PAGE_SIZE)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= total}
              className={`px-3 py-1 text-[12px] border-[2px] ${
                (page + 1) * PAGE_SIZE >= total
                  ? 'text-zinc-600 border-zinc-800 cursor-not-allowed'
                  : 'text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:border-zinc-500'
              }`}
            >
              Next \u2192
            </button>
          </div>
        </div>
      )}

      {actionFile && <ActionModal file={actionFile} onClose={() => setActionFile(null)} onDone={onActionDone} />}
    </div>
  );
}
