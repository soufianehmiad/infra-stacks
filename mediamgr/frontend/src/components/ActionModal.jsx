import { useState } from 'react'
import { api } from '../api.js'

const ACTIONS = [
  { id: 'reencode', label: 'Re-encode', sub: 'H.264 VAAPI QP26 · auto-revert if larger' },
  { id: 'remux', label: 'Remux', sub: 'Copy video stream · AAC 192k audio' },
  { id: 'downscale', label: 'Downscale', sub: 'Scale to 1080p H.264 VAAPI' },
  { id: 'delete', label: 'Delete', sub: 'Permanently remove from disk' },
  { id: 'skip', label: 'Skip', sub: 'No action — dismiss' },
]

export default function ActionModal({ file, onClose, onDone }) {
  const [action, setAction] = useState(file?.suggested_action || 'skip')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!file) return null

  async function handleConfirm() {
    if (action === 'skip') { onClose(); return }
    setLoading(true)
    setError(null)
    try {
      if (action === 'delete') {
        await api.deleteFile(file.id)
        onDone?.('deleted', file)
      } else {
        const job = await api.createJob(file.id, action)
        onDone?.('queued', file, job)
      }
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const isDanger = action === 'delete'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        background: 'rgba(10,10,14,0.8)', backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="animate-in"
        style={{
          width: '100%', maxWidth: '420px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
            Select action
          </p>
          <h2 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.filename}
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.path}
          </p>
        </div>

        {/* Action options */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {ACTIONS.map((a) => (
            <label
              key={a.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 12px', cursor: 'pointer',
                background: action === a.id ? 'var(--accent-dim)' : 'transparent',
                border: `1px solid ${action === a.id ? 'var(--accent)' : 'transparent'}`,
                borderRadius: '4px',
                transition: 'background 0.1s ease',
              }}
            >
              <div style={{
                width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
                border: `1.5px solid ${action === a.id ? 'var(--accent)' : 'var(--border-bright)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {action === a.id && (
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
                )}
              </div>
              <input type="radio" name="action" value={a.id} checked={action === a.id}
                onChange={() => setAction(a.id)} style={{ display: 'none' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '13px',
                    color: action === a.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: action === a.id ? 600 : 400,
                  }}>
                    {a.label}
                  </span>
                  {a.id === file.suggested_action && (
                    <span style={{
                      fontSize: '10px', color: 'var(--accent)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      suggested
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '1px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>
                  {a.sub}
                </p>
              </div>
            </label>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            margin: '0 16px 12px',
            padding: '8px 12px',
            fontSize: '12px', fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--danger)',
            background: 'rgba(184,96,112,0.08)',
            border: '1px solid rgba(184,96,112,0.2)',
          }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '0 16px 16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', fontSize: '13px',
              color: 'var(--text-secondary)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              fontFamily: "'Barlow', sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              padding: '8px 20px', fontSize: '13px', fontWeight: 600,
              color: isDanger ? '#fff' : '#0a0c0f',
              background: isDanger ? 'var(--danger)' : 'var(--accent)',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              fontFamily: "'Barlow', sans-serif",
            }}
          >
            {loading ? 'Working…' : action === 'skip' ? 'Dismiss' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
