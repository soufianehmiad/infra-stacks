// cortex/frontend/src/sections/Media.tsx
import { useEffect, useState } from 'react'
import { api, type MediaFileRecord } from '../lib/api'

const FOLDERS = ['movies', 'series', 'anime', 'downloads']

function fmt(bytes: number) {
  if (bytes > 1e9) return `${(bytes/1e9).toFixed(1)}G`
  return `${(bytes/1e6).toFixed(0)}M`
}

export function Media() {
  const [folder, setFolder] = useState<string | null>(null)
  const [files, setFiles] = useState<MediaFileRecord[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<MediaFileRecord | null>(null)
  const [search, setSearch] = useState('')
  const [codec, setCodec] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!folder) return
    const params: Record<string, unknown> = { folder, limit: 200 }
    if (search) params.search = search
    if (codec) params.codec = codec
    api.media.list(params).then(r => { setFiles(r.items); setTotal(r.total) }).catch(() => {})
  }, [folder, search, codec])

  const queueJob = async (action: string) => {
    if (!selected) return
    setBusy(true)
    try { await api.jobs.create(selected.id, action) } finally { setBusy(false) }
  }

  return (
    <div className="h-full flex gap-0">
      {/* Left: folder + filters + file list */}
      <div className="w-72 border-r border-[var(--color-border)] flex flex-col">
        <div className="mono text-[9px] text-[var(--color-text-muted)] tracking-widest px-4 py-3 border-b border-[var(--color-border)]">MEDIA LIBRARY</div>

        {/* Folders */}
        <div className="flex flex-col border-b border-[var(--color-border)]">
          {FOLDERS.map(f => (
            <button key={f} onClick={() => { setFolder(f); setSelected(null) }}
                    className={`mono text-xs px-4 py-2 text-left transition-colors hover:bg-[var(--color-surface)]
                                ${folder === f ? 'text-[var(--color-accent)] bg-[var(--color-surface)]' : 'text-[var(--color-text-muted)]'}`}>
              {f}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="px-3 py-2 border-b border-[var(--color-border)] flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
                 placeholder="search…"
                 className="flex-1 mono text-[10px] bg-transparent border border-[var(--color-border)] px-2 py-1 outline-none text-[var(--color-text-primary)] focus:border-[var(--color-accent)]" />
          <input value={codec} onChange={e => setCodec(e.target.value)}
                 placeholder="codec"
                 className="w-16 mono text-[10px] bg-transparent border border-[var(--color-border)] px-2 py-1 outline-none text-[var(--color-text-primary)] focus:border-[var(--color-accent)]" />
        </div>

        {/* File list */}
        <div className="flex-1 overflow-auto">
          {files.map(f => (
            <div key={f.id} onClick={() => setSelected(f)}
                 className={`px-3 py-2 border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface)] transition-colors
                             ${selected?.id === f.id ? 'bg-[var(--color-surface)]' : ''}`}>
              <div className="mono text-[10px] text-[var(--color-text-primary)] truncate">{f.filename}</div>
              <div className="mono text-[9px] text-[var(--color-text-muted)]">{f.codec ?? '?'} · {f.resolution ?? '?'} · {fmt(f.size_bytes)}</div>
            </div>
          ))}
          {folder && files.length === 0 && (
            <div className="mono text-[10px] text-[var(--color-text-muted)] px-4 py-6">no files</div>
          )}
          {!folder && (
            <div className="mono text-[10px] text-[var(--color-text-muted)] px-4 py-6">select a folder</div>
          )}
        </div>

        {folder && <div className="mono text-[9px] text-[var(--color-text-muted)] px-3 py-2 border-t border-[var(--color-border)]">{total} files</div>}
      </div>

      {/* Right: file detail */}
      <div className="flex-1 p-6 overflow-auto">
        {selected ? (
          <div className="space-y-4">
            <div className="mono text-[9px] text-[var(--color-text-muted)] tracking-widest">FILE DETAILS</div>
            <div className="mono text-sm text-[var(--color-text-primary)] break-all">{selected.filename}</div>
            <div className="space-y-1">
              {([
                ['path', selected.path],
                ['codec', selected.codec ?? '—'],
                ['resolution', selected.resolution ?? '—'],
                ['size', fmt(selected.size_bytes)],
                ['duration', selected.duration ? `${(selected.duration/60).toFixed(1)}m` : '—'],
                ['audio', selected.audio ?? '—'],
                ['suggested', selected.suggested_action ?? '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex gap-4">
                  <span className="mono text-[9px] text-[var(--color-text-muted)] w-20 shrink-0">{k}</span>
                  <span className="mono text-[10px] text-[var(--color-text-primary)] break-all">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              {(['reencode','remux','downscale','delete'] as const).map(action => (
                <button key={action} disabled={busy} onClick={() => queueJob(action)}
                        className={`mono text-[9px] px-3 py-1.5 border transition-colors disabled:opacity-40
                                    ${action === 'delete'
                                      ? 'border-[var(--color-down)] text-[var(--color-down)] hover:bg-[var(--color-down)]/10'
                                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]'}`}>
                  {action}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="mono text-[10px] text-[var(--color-text-muted)]">select a file</span>
          </div>
        )}
      </div>
    </div>
  )
}
