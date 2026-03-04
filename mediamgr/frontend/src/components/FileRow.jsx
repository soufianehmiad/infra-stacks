import { fmtBytes, fmtDuration } from '../api.js'

const CODEC_INFO = {
  hevc: { label: 'H.265', good: true },
  'h.265': { label: 'H.265', good: true },
  h265: { label: 'H.265', good: true },
  avc: { label: 'H.264', good: false },
  'h.264': { label: 'H.264', good: false },
  h264: { label: 'H.264', good: false },
  av1: { label: 'AV1', good: true },
}

const ACTION_LABEL = {
  reencode: 'Re-encode',
  remux: 'Remux',
  downscale: 'Downscale',
  skip: 'Skip',
  delete: 'Delete',
}

function CodecTag({ codec }) {
  const key = (codec || '').toLowerCase()
  const match = Object.entries(CODEC_INFO).find(([k]) => key.includes(k))
  const label = match ? match[1].label : codec
  const good = match ? match[1].good : false
  return (
    <span style={{
      fontSize: '12px',
      fontFamily: "'JetBrains Mono', monospace",
      color: good ? 'var(--accent)' : 'var(--text-secondary)',
    }}>
      {label}
    </span>
  )
}

export default function FileRow({ file, selected, onSelect, onAction }) {
  const actionLabel = ACTION_LABEL[file.suggested_action] || file.suggested_action
  const isSkip = file.suggested_action === 'skip'

  return (
    <tr className={`file-row ${selected ? 'selected' : ''}`}>
      <td style={{ padding: '10px 12px', width: '36px' }}>
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} />
      </td>
      <td style={{ padding: '10px 12px', maxWidth: '280px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.path || file.filename}>
          {file.filename}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
          {file.folder}
        </div>
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
        <span style={{ fontSize: '13px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>
          {fmtBytes(file.size_bytes)}
        </span>
      </td>
      <td style={{ padding: '10px 12px' }}>
        <CodecTag codec={file.codec} />
      </td>
      <td style={{ padding: '10px 12px' }}>
        <span style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>
          {file.resolution}
        </span>
      </td>
      <td style={{ padding: '10px 12px' }}>
        <span style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
          {fmtDuration(file.duration_s)}
        </span>
      </td>
      <td style={{ padding: '10px 12px', maxWidth: '110px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={file.audio_codec}>
          {file.audio_codec}
        </span>
      </td>
      <td style={{ padding: '10px 12px' }}>
        <span style={{ fontSize: '12px', color: isSkip ? 'var(--text-muted)' : 'var(--accent)', fontWeight: isSkip ? 400 : 500 }}>
          {actionLabel}
        </span>
      </td>
      <td style={{ padding: '10px 12px' }}>
        <button
          onClick={() => onAction(file)}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: "'Barlow', sans-serif",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.color = 'var(--accent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          {isSkip ? 'Action' : actionLabel}
        </button>
      </td>
    </tr>
  )
}
