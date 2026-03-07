// cortex/frontend/src/sections/Media.tsx — single table + right drawer
import { useEffect, useState, useCallback } from 'react'
import { ScanLine, Search, Filter, X } from 'lucide-react'
import { api, type MediaFileRecord } from '../lib/api'
import { Drawer } from '../components/Drawer'

const FOLDERS = ['all', 'movies', 'series', 'anime', 'downloads'] as const
const CODECS = ['all', 'hevc', 'h264', 'av1', 'mpeg4'] as const
const ACTIONS = ['all', 'reencode', 'remux', 'downscale', 'skip'] as const

function fmt(bytes: number) {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)}G`
  return `${(bytes / 1e6).toFixed(0)}M`
}

function duration(s: number | null) {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  if (m > 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${m}m`
}

const actionColors: Record<string, string> = {
  skip: 'text-[var(--color-text-muted)]',
  reencode: 'text-[var(--color-accent)]',
  remux: 'text-[var(--color-warn)]',
  downscale: 'text-[var(--color-warn)]',
}

export function Media() {
  const [folder, setFolder] = useState<string>('all')
  const [files, setFiles] = useState<MediaFileRecord[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [codec, setCodec] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [scanning, setScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState<{ running: boolean; scanned: number; total: number } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [drawerFile, setDrawerFile] = useState<MediaFileRecord | null>(null)
  const [busy, setBusy] = useState(false)

  const loadFiles = useCallback(() => {
    const params: Record<string, unknown> = { limit: 200 }
    if (folder !== 'all') params.folder = folder
    if (search) params.search = search
    if (codec !== 'all') params.codec = codec
    api.media.list(params).then(r => { setFiles(r.items); setTotal(r.total) }).catch(() => {})
  }, [folder, search, codec])

  useEffect(() => { loadFiles() }, [loadFiles])

  // Poll scan status
  useEffect(() => {
    if (!scanning) return
    const id = setInterval(async () => {
      try {
        const res = await fetch('/encoder/scan/status')
        const data = await res.json()
        setScanStatus(data)
        if (!data.running) { setScanning(false); loadFiles() }
      } catch { /* ignore */ }
    }, 2000)
    return () => clearInterval(id)
  }, [scanning, loadFiles])

  async function handleScan() {
    setScanning(true); setScanStatus({ running: true, scanned: 0, total: 0 })
    try { await fetch('/encoder/scan', { method: 'POST', credentials: 'include' }) }
    catch { setScanning(false); setScanStatus(null) }
  }

  const queueJob = async (fileId: number, action: string) => {
    setBusy(true)
    try { await api.jobs.create(fileId, action) } finally { setBusy(false) }
  }

  // Client-side filter by action
  const displayed = actionFilter === 'all' ? files : files.filter(f => f.suggested_action === actionFilter)

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border)] shrink-0 bg-[var(--color-surface)] flex-wrap">
        {/* Folder filters */}
        <div className="flex gap-1">
          {FOLDERS.map(f => (
            <button key={f} onClick={() => { setFolder(f); setSelected(new Set()) }}
                    className={`mono text-[10px] tracking-widest px-2.5 py-1.5 rounded-full border transition-colors
                      ${folder === f
                        ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[var(--color-border)]" />

        {/* Codec filter */}
        <div className="flex gap-1">
          {CODECS.map(c => (
            <button key={c} onClick={() => setCodec(c)}
                    className={`mono text-[10px] tracking-widest px-2 py-1.5 rounded-full border transition-colors
                      ${codec === c
                        ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[var(--color-border)]" />

        {/* Action filter */}
        <div className="flex gap-1">
          {ACTIONS.map(a => (
            <button key={a} onClick={() => setActionFilter(a)}
                    className={`mono text-[10px] tracking-widest px-2 py-1.5 rounded-full border transition-colors
                      ${actionFilter === a
                        ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}`}>
              {a}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-1.5 bg-[var(--color-void)] border border-[var(--color-border)] rounded-full px-3 ml-auto">
          <Search className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
                 placeholder="search..."
                 className="bg-transparent text-xs text-[var(--color-text-primary)] py-1.5 outline-none placeholder:text-[var(--color-text-muted)] w-32" />
          {search && (
            <button onClick={() => setSearch('')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Scan button */}
        <button onClick={handleScan} disabled={scanning}
                className="flex items-center gap-1.5 mono text-[10px] tracking-widest px-3 py-1.5 rounded-full border
                           border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)]
                           hover:border-[var(--color-accent)] disabled:opacity-40 transition-colors">
          <ScanLine className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? `${scanStatus?.scanned ?? 0}/${scanStatus?.total ?? '?'}` : 'Scan'}
        </button>

        {/* Count */}
        <span className="mono text-[10px] text-[var(--color-text-muted)]">{total} files</span>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-5 py-2 border-b border-[var(--color-border)] bg-[var(--color-accent-dim)] shrink-0">
          <span className="mono text-[10px] text-[var(--color-accent)]">{selected.size} selected</span>
          {(['reencode', 'remux', 'downscale'] as const).map(action => (
            <button key={action} onClick={async () => {
              setBusy(true)
              try { await Promise.allSettled(Array.from(selected).map(id => api.jobs.create(id, action))) }
              finally { setBusy(false); setSelected(new Set()) }
            }} disabled={busy}
                    className="mono text-[10px] px-2.5 py-1 rounded border border-[var(--color-border)] text-[var(--color-accent)] hover:bg-[var(--color-accent-dim)] disabled:opacity-40 transition-colors">
              {action}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} className="mono text-[10px] text-[var(--color-text-muted)] ml-auto">Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-void)] border-b border-[var(--color-border)]">
              <th className="w-8 px-3 py-2">
                <input type="checkbox"
                       checked={selected.size === displayed.length && displayed.length > 0}
                       onChange={() => {
                         if (selected.size === displayed.length) setSelected(new Set())
                         else setSelected(new Set(displayed.map(f => f.id)))
                       }}
                       className="accent-[var(--color-accent)]" />
              </th>
              <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-left px-3 py-2">FILENAME</th>
              <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-left px-3 py-2 w-16 hidden sm:table-cell">CODEC</th>
              <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-left px-3 py-2 w-20 hidden md:table-cell">RES</th>
              <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-right px-3 py-2 w-16 hidden md:table-cell">SIZE</th>
              <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-right px-3 py-2 w-16 hidden lg:table-cell">DUR</th>
              <th className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider text-left px-3 py-2 w-20 hidden sm:table-cell">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(f => (
              <tr key={f.id}
                  onClick={() => setDrawerFile(f)}
                  className={`border-b border-[var(--color-border)] cursor-pointer transition-colors
                    ${selected.has(f.id) ? 'bg-[var(--color-accent-dim)]' : 'hover:bg-[var(--color-elevated)]'}`}>
                <td className="w-8 px-3 py-2" onClick={e => { e.stopPropagation(); toggleSelect(f.id) }}>
                  <input type="checkbox" checked={selected.has(f.id)} readOnly className="accent-[var(--color-accent)] pointer-events-none" />
                </td>
                <td className="px-3 py-2 text-xs text-[var(--color-text-primary)] truncate max-w-0">{f.filename}</td>
                <td className="px-3 py-2 mono text-[10px] text-[var(--color-text-muted)] hidden sm:table-cell">{f.codec ?? '?'}</td>
                <td className="px-3 py-2 mono text-[10px] text-[var(--color-text-muted)] hidden md:table-cell">{f.resolution ?? '?'}</td>
                <td className="px-3 py-2 mono text-[10px] text-[var(--color-text-muted)] text-right hidden md:table-cell">{fmt(f.size_bytes)}</td>
                <td className="px-3 py-2 mono text-[10px] text-[var(--color-text-muted)] text-right hidden lg:table-cell">{duration(f.duration)}</td>
                <td className="px-3 py-2 hidden sm:table-cell">
                  {f.suggested_action && f.suggested_action !== 'skip' ? (
                    <span className={`mono text-[10px] px-2 py-0.5 rounded ${actionColors[f.suggested_action] ?? ''}`}>
                      {f.suggested_action}
                    </span>
                  ) : (
                    <span className="mono text-[10px] text-[var(--color-text-muted)]">—</span>
                  )}
                </td>
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <span className="mono text-xs text-[var(--color-text-muted)]">
                    {scanning ? `Scanning... ${scanStatus?.scanned ?? 0}/${scanStatus?.total ?? '?'}` :
                     total === 0 ? 'No files — click Scan to populate' : 'No matches'}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      <Drawer open={!!drawerFile} onClose={() => setDrawerFile(null)} title="FILE DETAILS">
        {drawerFile && (
          <div className="p-5 space-y-5">
            <h3 className="text-sm text-[var(--color-text-primary)] break-all leading-relaxed">{drawerFile.filename}</h3>

            <div className="grid grid-cols-2 gap-3">
              {([
                ['Codec', drawerFile.codec ?? '—'],
                ['Resolution', drawerFile.resolution ?? '—'],
                ['Size', fmt(drawerFile.size_bytes)],
                ['Duration', duration(drawerFile.duration)],
                ['Audio', drawerFile.audio ?? '—'],
                ['Action', drawerFile.suggested_action ?? '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <div className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider mb-0.5">{k.toUpperCase()}</div>
                  <div className={`text-xs text-[var(--color-text-primary)] ${k === 'Action' ? (actionColors[v] ?? '') : ''}`}>{v}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider mb-1">PATH</div>
              <div className="text-[10px] text-[var(--color-text-primary)] break-all bg-[var(--color-void)] rounded-lg p-3 border border-[var(--color-border)]">
                {drawerFile.path}
              </div>
            </div>

            <div>
              <div className="mono text-[9px] text-[var(--color-text-muted)] tracking-wider mb-2">QUEUE JOB</div>
              <div className="flex gap-2">
                {(['reencode', 'remux', 'downscale'] as const).map(action => (
                  <button key={action} disabled={busy} onClick={() => queueJob(drawerFile.id, action)}
                          className="flex-1 px-3 py-2.5 text-xs rounded-lg border border-[var(--color-border)]
                                     text-[var(--color-text-muted)] hover:text-[var(--color-accent)]
                                     hover:border-[var(--color-accent)] disabled:opacity-40 transition-colors">
                    {action}
                  </button>
                ))}
              </div>
              <button disabled={busy} onClick={() => queueJob(drawerFile.id, 'delete')}
                      className="w-full mt-2 px-3 py-2.5 text-xs rounded-lg border border-[var(--color-down)]/30
                                 text-[var(--color-down)] hover:bg-[rgba(239,68,68,0.08)]
                                 disabled:opacity-40 transition-colors">
                delete original
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
