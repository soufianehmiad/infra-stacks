import { useEffect, useState, useCallback, useRef } from 'react'
import { api, fmtBytes, fmtDuration } from '../api.js'
import ActionModal from '../components/ActionModal.jsx'
import LoadingDots from '../components/LoadingDots.jsx'

const PAGE_SIZE = 100
const FOLDER_TABS = ['all', 'movies', 'series', 'anime', 'downloads']

// Grid column template — shared by header row and every data row
const GRID = '36px 1fr 90px 72px 64px 82px 108px 90px 78px'

const CODEC_OPTIONS  = [{ v: 'hevc', l: 'H.265' }, { v: 'avc', l: 'H.264' }, { v: 'av1', l: 'AV1' }]
const RES_OPTIONS    = [{ v: '4K', l: '4K' }, { v: '1080p', l: '1080p' }, { v: '720p', l: '720p' }]
const AUDIO_OPTIONS  = [{ v: 'AAC', l: 'AAC' }, { v: 'EAC3', l: 'EAC3' }, { v: 'AC3', l: 'AC3' }, { v: 'TrueHD', l: 'TrueHD' }, { v: 'DTS', l: 'DTS' }]
const ACTION_OPTIONS = [{ v: 'reencode', l: 'Re-encode' }, { v: 'remux', l: 'Remux' }, { v: 'downscale', l: 'Downscale' }, { v: 'skip', l: 'Skip' }]

const CODEC_MAP = {
  hevc: { label: 'H.265', good: true }, 'h.265': { label: 'H.265', good: true }, h265: { label: 'H.265', good: true },
  avc:  { label: 'H.264', good: false }, 'h.264': { label: 'H.264', good: false }, h264: { label: 'H.264', good: false },
  av1:  { label: 'AV1',   good: true },
}
const ACTION_LABEL = { reencode: 'Re-encode', remux: 'Remux', downscale: 'Downscale', skip: 'Skip', delete: 'Delete' }

const HEADERS = [
  { label: 'Filename', col: 'filename',         align: 'left'  },
  { label: 'Size',     col: 'size_bytes',       align: 'right' },
  { label: 'Codec',    col: 'codec',            align: 'left'  },
  { label: 'Res',      col: 'height',           align: 'left'  },
  { label: 'Duration', col: 'duration_s',       align: 'left'  },
  { label: 'Audio',    col: 'audio_codec',      align: 'left'  },
  { label: 'Action',   col: 'suggested_action', align: 'left'  },
  { label: '',         col: null,               align: 'left'  },
]

// ─── Filter dropdown ───────────────────────────────────────────────────────────

function FilterDropdown({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find(o => o.v === value)

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '4px 12px', height: '28px',
          fontSize: '12px', fontFamily: "'Barlow', sans-serif",
          background: selected ? 'var(--accent-dim)' : 'var(--bg-base)',
          color: selected ? 'var(--accent)' : 'var(--text-secondary)',
          border: selected ? '1px solid rgba(106,171,132,0.4)' : '1px solid var(--border)',
          borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'color 0.1s, border-color 0.1s, background 0.1s',
        }}
        onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
        onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
      >
        <span style={{ fontSize: '9px', color: selected ? 'var(--accent)' : 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em' }}>
          {label}
        </span>
        {selected && <span style={{ width: '1px', height: '12px', background: 'rgba(106,171,132,0.3)', flexShrink: 0 }} />}
        <span style={{ fontSize: '11px' }}>{selected ? selected.l : ''}</span>
        {selected ? (
          <span onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false) }}
            style={{ marginLeft: '2px', fontSize: '13px', lineHeight: 1, color: 'var(--accent)', opacity: 0.7, cursor: 'pointer' }}>×</span>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.4 }}>
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)',
          borderRadius: '4px', minWidth: '100%', overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {options.map(o => (
            <button key={o.v} onClick={() => { onChange(o.v === value ? '' : o.v); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', fontSize: '12px', fontFamily: "'Barlow', sans-serif",
                color: o.v === value ? 'var(--accent)' : 'var(--text-secondary)',
                background: o.v === value ? 'var(--accent-dim)' : 'transparent',
                border: 'none', cursor: 'pointer',
                borderLeft: o.v === value ? '2px solid var(--accent)' : '2px solid transparent',
              }}
              onMouseEnter={(e) => { if (o.v !== value) { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
              onMouseLeave={(e) => { if (o.v !== value) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
            >{o.l}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Scan button ──────────────────────────────────────────────────────────────

function ScanButton({ status, onScan }) {
  const isRunning = status.running
  const pct = status.total > 0 ? Math.round((status.scanned / status.total) * 100) : 0
  return (
    <button onClick={onScan} disabled={isRunning} style={{
      padding: '8px 16px', fontSize: '13px', fontWeight: 600,
      background: isRunning ? 'var(--bg-elevated)' : 'var(--accent)',
      color: isRunning ? 'var(--accent)' : '#0a0c0f',
      border: isRunning ? '1px solid var(--accent)' : '1px solid transparent',
      cursor: isRunning ? 'not-allowed' : 'pointer',
      fontFamily: "'Barlow', sans-serif", display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px',
    }}>
      {isRunning ? (
        <><div className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />Scanning {pct}%</>
      ) : 'Scan Library'}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Library() {
  const [files, setFiles]               = useState([])
  const [total, setTotal]               = useState(0)
  const [page, setPage]                 = useState(0)
  const [loading, setLoading]           = useState(true)
  const [folder, setFolder]             = useState('all')
  const [codec, setCodec]               = useState('')
  const [resolution, setResolution]     = useState('')
  const [audio, setAudio]               = useState('')
  const [suggestedAction, setSuggestedAction] = useState('')
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy]             = useState('size_bytes')
  const [sortDir, setSortDir]           = useState('desc')
  const [selected, setSelected]         = useState(new Set())
  const [actionFile, setActionFile]     = useState(null)
  const [scanStatus, setScanStatus]     = useState({ running: false, scanned: 0, total: 0 })
  const [toast, setToast]               = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(0) }, [folder, codec, resolution, audio, debouncedSearch, suggestedAction, sortBy, sortDir])

  const load = useCallback(async () => {
    try {
      const data = await api.files({
        folder, codec, resolution, audio,
        search: debouncedSearch, suggested_action: suggestedAction,
        limit: PAGE_SIZE, offset: page * PAGE_SIZE,
        sort_by: sortBy, sort_dir: sortDir,
      })
      setFiles(data.items)
      setTotal(data.total)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [folder, codec, resolution, audio, debouncedSearch, suggestedAction, page, sortBy, sortDir])

  useEffect(() => { setLoading(true); load() }, [load])

  useEffect(() => {
    const poll = async () => { try { setScanStatus(await api.scanStatus()) } catch {} }
    poll()
    const t = setInterval(poll, scanStatus.running ? 1000 : 5000)
    return () => clearInterval(t)
  }, [scanStatus.running])

  function notify(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }
  async function handleScan() { await api.startScan(); notify('Scan started') }

  function toggleSelect(id, checked) {
    setSelected(prev => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n })
  }
  function toggleAll(checked) {
    setSelected(checked ? new Set(files.map(f => f.id)) : new Set())
  }

  async function executeBulkAction(action) {
    const ids = Array.from(selected)
    let ok = 0, fail = 0
    for (const id of ids) {
      try { action === 'delete' ? await api.deleteFile(id) : await api.createJob(id, action); ok++ }
      catch (e) { fail++; console.error(e) }
    }
    setSelected(new Set()); setConfirmDelete(null)
    notify(fail > 0 ? `${ok} done, ${fail} failed` : `${ok} items → ${action}`)
    load()
  }

  function handleBulkAction(action) {
    action === 'delete' ? setConfirmDelete(selected.size) : executeBulkAction(action)
  }

  function onActionDone(type) { notify(type === 'deleted' ? 'File deleted' : 'Job queued'); load() }

  function clearFilters() { setCodec(''); setResolution(''); setAudio(''); setSuggestedAction(''); setSearch('') }

  function handleSort(col) {
    if (sortBy === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') }
    else { setSortBy(col); setSortDir('desc') }
  }

  const allSelected = files.length > 0 && selected.size === files.length
  const hasFilters   = codec || resolution || audio || suggestedAction || debouncedSearch

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: 'calc(100vh - 64px)', overflow: 'hidden' }} className="animate-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em' }}>
            Library
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
            {loading ? '—' : `${total.toLocaleString()} files`}
          </p>
        </div>
        <ScanButton status={scanStatus} onScan={handleScan} />
      </div>

      {/* Toast */}
      {toast && (
        <div className="animate-in" style={{
          padding: '8px 12px', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent)',
        }}>{toast}</div>
      )}

      {/* Bulk delete confirmation */}
      {confirmDelete != null && (
        <div className="animate-in" style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
          background: 'rgba(184,96,112,0.08)', border: '1px solid var(--danger)',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--danger)' }}>
            Permanently delete {confirmDelete} file{confirmDelete !== 1 ? 's' : ''} from disk?
          </span>
          <button onClick={() => executeBulkAction('delete')} style={{
            padding: '4px 12px', fontSize: '12px', fontWeight: 600,
            color: '#fff', background: 'var(--danger)', border: 'none', cursor: 'pointer',
            fontFamily: "'Barlow', sans-serif",
          }}>Delete</button>
          <button onClick={() => setConfirmDelete(null)} style={{
            padding: '4px 12px', fontSize: '12px', color: 'var(--text-muted)',
            background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer',
            fontFamily: "'Barlow', sans-serif",
          }}>Cancel</button>
        </div>
      )}

      {/* ── Filter panel ─────────────────────────────────────────────────────── */}
      <div style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>

        {/* Folder tabs + Search */}
        <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--border)' }}>
          {FOLDER_TABS.map(f => (
            <button key={f} onClick={() => setFolder(f)} style={{
              padding: '0 18px', height: '38px', fontSize: '12px', fontFamily: "'Barlow', sans-serif",
              fontWeight: folder === f ? 600 : 400,
              color: folder === f ? 'var(--accent)' : 'var(--text-muted)',
              background: 'transparent', border: 'none',
              borderBottom: folder === f ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', transition: 'color 0.1s, border-color 0.1s',
              textTransform: 'capitalize', flexShrink: 0,
            }}
              onMouseEnter={(e) => { if (folder !== f) e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={(e) => { if (folder !== f) e.currentTarget.style.color = 'var(--text-muted)' }}
            >{f}</button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 14px', borderLeft: '1px solid var(--border)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ color: search ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0, transition: 'color 0.1s' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input type="text" placeholder="Search files…" value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: '180px', border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', color: 'var(--text-primary)', fontFamily: "'Barlow', sans-serif" }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: '16px', lineHeight: 1 }}>×</button>
            )}
          </div>
        </div>

        {/* Filter dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: '46px', gap: '8px' }}>
          <FilterDropdown label="CODEC"  options={CODEC_OPTIONS}  value={codec}           onChange={setCodec} />
          <FilterDropdown label="RES"    options={RES_OPTIONS}    value={resolution}      onChange={setResolution} />
          <FilterDropdown label="AUDIO"  options={AUDIO_OPTIONS}  value={audio}           onChange={setAudio} />
          <FilterDropdown label="ACTION" options={ACTION_OPTIONS} value={suggestedAction} onChange={setSuggestedAction} />
          {hasFilters && (
            <>
              <div style={{ flex: 1 }} />
              <button onClick={clearFilters} style={{
                padding: '4px 8px', fontSize: '11px', flexShrink: 0,
                fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--text-muted)', background: 'transparent',
                border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-bright)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              >clear all</button>
            </>
          )}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="animate-in" style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px',
          background: 'var(--accent-dim)', border: '1px solid var(--accent)',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>
            {selected.size} selected
          </span>
          <div style={{ width: '1px', height: '16px', background: 'var(--border-bright)' }} />
          {[{ id: 'reencode', label: 'Re-encode' }, { id: 'remux', label: 'Remux' }, { id: 'downscale', label: 'Downscale' }, { id: 'delete', label: 'Delete' }].map((a) => (
            <button key={a.id} onClick={() => handleBulkAction(a.id)} style={{
              padding: '4px 12px', fontSize: '12px', fontFamily: "'Barlow', sans-serif",
              color: a.id === 'delete' ? 'var(--danger)' : 'var(--text-secondary)',
              border: `1px solid ${a.id === 'delete' ? 'var(--danger)' : 'var(--border)'}`,
              background: 'transparent', cursor: 'pointer',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.color = a.id === 'delete' ? 'var(--danger)' : 'var(--accent)'; e.currentTarget.style.borderColor = a.id === 'delete' ? 'var(--danger)' : 'var(--accent)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = a.id === 'delete' ? 'var(--danger)' : 'var(--text-secondary)'; e.currentTarget.style.borderColor = a.id === 'delete' ? 'var(--danger)' : 'var(--border)' }}
            >{a.label}</button>
          ))}
          <button onClick={() => setSelected(new Set())} style={{
            marginLeft: 'auto', padding: '4px 12px', fontSize: '12px',
            fontFamily: "'Barlow', sans-serif", color: 'var(--text-muted)',
            border: 'none', background: 'transparent', cursor: 'pointer',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >Clear</button>
        </div>
      )}

      {/* ── Table (CSS Grid — header and rows share GRID template) ──────────── */}
      {loading ? (
        <LoadingDots />
      ) : files.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '8px' }}>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif" }}>
            {hasFilters ? 'No files match the current filters' : 'No files found'}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            {hasFilters ? 'Try adjusting or clearing the filters' : 'Run a scan to index the library'}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} style={{
              marginTop: '8px', padding: '6px 16px', fontSize: '12px',
              color: 'var(--accent)', background: 'var(--accent-dim)',
              border: '1px solid var(--accent)', cursor: 'pointer', fontFamily: "'Barlow', sans-serif",
            }}>Clear filters</button>
          )}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', overflow: 'hidden', overflowY: 'auto', flex: 1, minHeight: 0 }}>

          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: GRID,
            background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
            minWidth: 0, position: 'sticky', top: 0, zIndex: 1,
          }}>
            <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
            </div>
            {HEADERS.map(({ label, col, align }) => (
              <div
                key={label || '_btn'}
                onClick={col ? () => handleSort(col) : undefined}
                style={{
                  padding: '10px 12px',
                  display: 'flex', alignItems: 'center',
                  justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
                  gap: '4px',
                  fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 400,
                  color: col && sortBy === col ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: col ? 'pointer' : 'default',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => { if (col && sortBy !== col) e.currentTarget.style.color = 'var(--text-secondary)' }}
                onMouseLeave={(e) => { if (col && sortBy !== col) e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                {label}
                {col && sortBy === col && (
                  <span style={{ fontSize: '10px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            ))}
          </div>

          {/* Data rows */}
          <div style={{ background: 'var(--bg-base)' }}>
            {files.map((f) => {
              const codecKey = (f.codec || '').toLowerCase()
              const codecMatch = Object.entries(CODEC_MAP).find(([k]) => codecKey.includes(k))
              const codecLabel = codecMatch ? codecMatch[1].label : f.codec
              const codecGood  = codecMatch ? codecMatch[1].good : false
              const actionLabel = ACTION_LABEL[f.suggested_action] || f.suggested_action
              const isSkip = f.suggested_action === 'skip'
              const isSelected = selected.has(f.id)

              return (
                <div
                  key={f.id}
                  className={`file-row${isSelected ? ' selected' : ''}`}
                  style={{ display: 'grid', gridTemplateColumns: GRID, minWidth: 0 }}
                >
                  {/* Checkbox */}
                  <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center' }}>
                    <input type="checkbox" checked={isSelected} onChange={(e) => toggleSelect(f.id, e.target.checked)} />
                  </div>

                  {/* Filename */}
                  <div style={{ padding: '10px 12px', minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.path || f.filename}>
                      {f.filename}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{f.folder}</div>
                  </div>

                  {/* Size */}
                  <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '13px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>
                      {fmtBytes(f.size_bytes)}
                    </span>
                  </div>

                  {/* Codec */}
                  <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: codecGood ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {codecLabel}
                    </span>
                  </div>

                  {/* Res */}
                  <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>
                      {f.resolution}
                    </span>
                  </div>

                  {/* Duration */}
                  <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                      {fmtDuration(f.duration_s)}
                    </span>
                  </div>

                  {/* Audio */}
                  <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.audio_codec}>
                      {f.audio_codec}
                    </span>
                  </div>

                  {/* Suggested action */}
                  <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: isSkip ? 'var(--text-muted)' : 'var(--accent)', fontWeight: isSkip ? 400 : 500 }}>
                      {actionLabel}
                    </span>
                  </div>

                  {/* Action button */}
                  <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center' }}>
                    <button
                      onClick={() => setActionFile(f)}
                      style={{
                        padding: '4px 12px', fontSize: '11px', height: 'var(--btn-h)',
                        color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)', borderRadius: '4px',
                        cursor: 'pointer', fontFamily: "'Barlow', sans-serif",
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                    >
                      {isSkip ? 'Action' : actionLabel}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0} style={{
              padding: '4px 12px', fontSize: '12px', fontFamily: "'Barlow', sans-serif",
              color: page === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
            }}>← Prev</button>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", minWidth: '80px', textAlign: 'center' }}>
              {page + 1} / {Math.ceil(total / PAGE_SIZE)}
            </span>
            <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total} style={{
              padding: '4px 12px', fontSize: '12px', fontFamily: "'Barlow', sans-serif",
              color: (page + 1) * PAGE_SIZE >= total ? 'var(--text-muted)' : 'var(--text-secondary)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              cursor: (page + 1) * PAGE_SIZE >= total ? 'not-allowed' : 'pointer',
            }}>Next →</button>
          </div>
        </div>
      )}

      {actionFile && (
        <ActionModal file={actionFile} onClose={() => setActionFile(null)} onDone={onActionDone} />
      )}
    </div>
  )
}
