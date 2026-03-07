// cortex/frontend/src/sections/Media.tsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { ScanLine, Search, X, ChevronRight, Folder } from 'lucide-react'
import { api, type MediaFileRecord } from '../lib/api'
import { Drawer } from '../components/Drawer'

const FOLDERS = ['all', 'movies', 'series', 'anime', 'downloads'] as const
const CODECS = ['all', 'hevc', 'h264', 'av1', 'mpeg4'] as const
const ACTIONS = ['all', 'reencode', 'remux', 'downscale', 'skip'] as const
const GROUPABLE = new Set(['series', 'anime'])

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

/** Extract series/show folder name from path like /media/series/Show Name (2020)/Season 01/file.mkv */
function getSeriesFolder(path: string): string | null {
  // /media/{folder}/{SeriesName}/...
  const parts = path.split('/')
  // parts: ['', 'media', 'series', 'Show Name (2020)', 'Season 01', 'file.mkv']
  if (parts.length >= 4) return parts[3]
  return null
}

interface FolderGroup {
  name: string
  files: MediaFileRecord[]
  totalSize: number
  codecs: Set<string>
  actions: Set<string>
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const loadFiles = useCallback(() => {
    const params: Record<string, unknown> = { limit: 500 }
    if (folder !== 'all') params.folder = folder
    if (search) params.search = search
    if (codec !== 'all') params.codec = codec
    api.media.list(params).then(r => { setFiles(r.items); setTotal(r.total) }).catch(() => {})
  }, [folder, search, codec])

  useEffect(() => { loadFiles() }, [loadFiles])

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

  const displayed = actionFilter === 'all' ? files : files.filter(f => f.suggested_action === actionFilter)

  // Determine if we should group: only for series/anime (or 'all' when files belong to groupable folders)
  const shouldGroup = folder === 'series' || folder === 'anime' ||
    (folder === 'all' && displayed.some(f => GROUPABLE.has(f.folder)))

  const { groups, ungrouped } = useMemo(() => {
    if (!shouldGroup) return { groups: [] as FolderGroup[], ungrouped: displayed }

    const groupMap = new Map<string, MediaFileRecord[]>()
    const flat: MediaFileRecord[] = []

    for (const f of displayed) {
      if (GROUPABLE.has(f.folder)) {
        const seriesName = getSeriesFolder(f.path)
        if (seriesName) {
          if (!groupMap.has(seriesName)) groupMap.set(seriesName, [])
          groupMap.get(seriesName)!.push(f)
          continue
        }
      }
      flat.push(f)
    }

    const groups: FolderGroup[] = [...groupMap.entries()]
      .map(([name, files]) => ({
        name,
        files: files.sort((a, b) => a.filename.localeCompare(b.filename)),
        totalSize: files.reduce((s, f) => s + f.size_bytes, 0),
        codecs: new Set(files.map(f => f.codec).filter(Boolean) as string[]),
        actions: new Set(files.map(f => f.suggested_action).filter(Boolean) as string[]),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return { groups, ungrouped: flat }
  }, [displayed, shouldGroup])

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleGroup(name: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  function selectGroup(group: FolderGroup) {
    setSelected(prev => {
      const next = new Set(prev)
      const allSelected = group.files.every(f => next.has(f.id))
      if (allSelected) {
        group.files.forEach(f => next.delete(f.id))
      } else {
        group.files.forEach(f => next.add(f.id))
      }
      return next
    })
  }

  function renderFileRow(f: MediaFileRecord, indent = false) {
    return (
      <tr key={f.id}
          onClick={() => setDrawerFile(f)}
          className={`border-b border-[var(--color-border)] cursor-pointer transition-colors
            ${selected.has(f.id) ? 'bg-[var(--color-accent-dim)]' : 'hover:bg-[var(--color-elevated)]'}`}>
        <td className="w-8 px-4 py-2.5" onClick={e => { e.stopPropagation(); toggleSelect(f.id) }}>
          <input type="checkbox" checked={selected.has(f.id)} readOnly className="accent-[var(--color-accent)] pointer-events-none" />
        </td>
        <td className={`table-cell text-[var(--color-text-primary)] truncate max-w-0 ${indent ? 'pl-10' : ''}`}>{f.filename}</td>
        <td className="table-cell-mono hidden sm:table-cell">{f.codec ?? '?'}</td>
        <td className="table-cell-mono hidden md:table-cell">{f.resolution ?? '?'}</td>
        <td className="table-cell-mono text-right hidden md:table-cell">{fmt(f.size_bytes)}</td>
        <td className="table-cell-mono text-right hidden lg:table-cell">{duration(f.duration)}</td>
        <td className="table-cell hidden sm:table-cell">
          {f.suggested_action && f.suggested_action !== 'skip' ? (
            <span className={`font-display text-[11px] px-2 py-0.5 ${actionColors[f.suggested_action] ?? ''}`}>
              {f.suggested_action}
            </span>
          ) : (
            <span className="font-display text-[11px] text-[var(--color-text-muted)]">—</span>
          )}
        </td>
      </tr>
    )
  }

  function getGroupAction(group: FolderGroup): string | null {
    const meaningful = [...group.actions].filter(a => a !== 'skip')
    if (meaningful.length === 1) return meaningful[0]
    if (meaningful.length > 1) return 'mixed'
    return null
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="flex gap-1">
          {FOLDERS.map(f => (
            <button key={f} onClick={() => { setFolder(f); setSelected(new Set()); setExpanded(new Set()) }}
                    className={`pill ${folder === f ? 'pill-active' : ''}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-[var(--color-border)]" />

        <div className="flex gap-1">
          {CODECS.map(c => (
            <button key={c} onClick={() => setCodec(c)}
                    className={`pill ${codec === c ? 'pill-active' : ''}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-[var(--color-border)]" />

        <div className="flex gap-1">
          {ACTIONS.map(a => (
            <button key={a} onClick={() => setActionFilter(a)}
                    className={`pill ${actionFilter === a ? 'pill-active' : ''}`}>
              {a}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 bg-[var(--color-void)] border border-[var(--color-border)] px-3 ml-auto">
          <Search className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
                 placeholder="search..."
                 className="bg-transparent text-[12px] text-[var(--color-text-primary)] py-1.5 outline-none placeholder:text-[var(--color-text-muted)] w-28" />
          {search && (
            <button onClick={() => setSearch('')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button onClick={handleScan} disabled={scanning}
                className={`pill flex items-center gap-1.5 ${scanning ? 'pill-active' : ''}`}>
          <ScanLine className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? `${scanStatus?.scanned ?? 0}/${scanStatus?.total ?? '?'}` : 'Scan'}
        </button>

        <span className="label">{total} files</span>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-6 py-2 border-b border-[var(--color-border)] bg-[var(--color-accent-dim)] shrink-0">
          <span className="font-display text-[11px] text-[var(--color-accent)]">{selected.size} selected</span>
          {(['reencode', 'remux', 'downscale'] as const).map(action => (
            <button key={action} onClick={async () => {
              setBusy(true)
              try { await Promise.allSettled(Array.from(selected).map(id => api.jobs.create(id, action))) }
              finally { setBusy(false); setSelected(new Set()) }
            }} disabled={busy} className="btn btn-accent text-[10px] py-1 px-2.5">
              {action}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} className="font-display text-[11px] text-[var(--color-text-muted)] ml-auto">Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-void)] border-b border-[var(--color-border)]">
              <th className="w-8 px-4 py-2">
                <input type="checkbox"
                       checked={selected.size === displayed.length && displayed.length > 0}
                       onChange={() => {
                         if (selected.size === displayed.length) setSelected(new Set())
                         else setSelected(new Set(displayed.map(f => f.id)))
                       }}
                       className="accent-[var(--color-accent)]" />
              </th>
              <th className="table-header">FILENAME</th>
              <th className="table-header w-16 hidden sm:table-cell">CODEC</th>
              <th className="table-header w-20 hidden md:table-cell">RES</th>
              <th className="table-header text-right w-16 hidden md:table-cell">SIZE</th>
              <th className="table-header text-right w-16 hidden lg:table-cell">DUR</th>
              <th className="table-header w-20 hidden sm:table-cell">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {/* Grouped folders */}
            {groups.map(group => {
              const isOpen = expanded.has(group.name)
              const allSelected = group.files.every(f => selected.has(f.id))
              const someSelected = !allSelected && group.files.some(f => selected.has(f.id))
              const groupAction = getGroupAction(group)

              return (
                <>{/* Group header row */}
                  <tr key={`g-${group.name}`}
                      className="border-b border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-elevated)] cursor-pointer transition-colors">
                    <td className="w-8 px-4 py-2.5" onClick={e => { e.stopPropagation(); selectGroup(group) }}>
                      <input type="checkbox" checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected }}
                             readOnly className="accent-[var(--color-accent)] pointer-events-none" />
                    </td>
                    <td className="table-cell" onClick={() => toggleGroup(group.name)}>
                      <div className="flex items-center gap-2">
                        <ChevronRight className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        <Folder className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                        <span className="text-[var(--color-text-primary)] font-medium">{group.name}</span>
                        <span className="font-display text-[11px] text-[var(--color-text-muted)]">{group.files.length} files</span>
                      </div>
                    </td>
                    <td className="table-cell-mono hidden sm:table-cell" onClick={() => toggleGroup(group.name)}>
                      {[...group.codecs].join(', ') || '?'}
                    </td>
                    <td className="table-cell-mono hidden md:table-cell" onClick={() => toggleGroup(group.name)}>—</td>
                    <td className="table-cell-mono text-right hidden md:table-cell" onClick={() => toggleGroup(group.name)}>
                      {fmt(group.totalSize)}
                    </td>
                    <td className="table-cell-mono text-right hidden lg:table-cell" onClick={() => toggleGroup(group.name)}>—</td>
                    <td className="table-cell hidden sm:table-cell" onClick={() => toggleGroup(group.name)}>
                      {groupAction && groupAction !== 'skip' ? (
                        <span className={`font-display text-[11px] px-2 py-0.5 ${groupAction === 'mixed' ? 'text-[var(--color-warn)]' : (actionColors[groupAction] ?? '')}`}>
                          {groupAction}
                        </span>
                      ) : (
                        <span className="font-display text-[11px] text-[var(--color-text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                  {/* Expanded children */}
                  {isOpen && group.files.map(f => renderFileRow(f, true))}
                </>
              )
            })}

            {/* Ungrouped files (movies, downloads, or non-groupable) */}
            {ungrouped.map(f => renderFileRow(f))}

            {displayed.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <span className="font-display text-[12px] text-[var(--color-text-muted)]">
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
          <div className="p-6 space-y-6">
            <h3 className="text-[13px] text-[var(--color-text-primary)] break-all leading-relaxed">{drawerFile.filename}</h3>

            <div className="grid grid-cols-2 gap-4">
              {([
                ['Codec', drawerFile.codec ?? '—'],
                ['Resolution', drawerFile.resolution ?? '—'],
                ['Size', fmt(drawerFile.size_bytes)],
                ['Duration', duration(drawerFile.duration)],
                ['Audio', drawerFile.audio ?? '—'],
                ['Action', drawerFile.suggested_action ?? '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <div className="label mb-1">{k.toUpperCase()}</div>
                  <div className={`text-[13px] text-[var(--color-text-primary)] ${k === 'Action' ? (actionColors[v] ?? '') : ''}`}>{v}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="label mb-1.5">PATH</div>
              <div className="text-[11px] text-[var(--color-text-primary)] break-all bg-[var(--color-void)] p-3 border border-[var(--color-border)]">
                {drawerFile.path}
              </div>
            </div>

            <div>
              <div className="label mb-2">QUEUE JOB</div>
              <div className="flex gap-2">
                {(['reencode', 'remux', 'downscale'] as const).map(action => (
                  <button key={action} disabled={busy} onClick={() => queueJob(drawerFile.id, action)}
                          className="btn flex-1">
                    {action}
                  </button>
                ))}
              </div>
              <button disabled={busy} onClick={() => queueJob(drawerFile.id, 'delete')}
                      className="btn btn-danger w-full mt-2">
                delete original
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
