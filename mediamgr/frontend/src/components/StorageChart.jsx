import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { fmtBytes } from '../api.js'

// Use a single muted palette — easier on the eyes
const FOLDER_COLORS = {
  movies:    '#6aab84',
  series:    '#5a8faa',
  anime:     '#8a7aaa',
  downloads: '#8a8a6a',
  free:      '#2a2a36',
}

const FOLDER_LABELS = {
  movies: 'Movies',
  series: 'Series',
  anime: 'Anime',
  downloads: 'Downloads',
  free: 'Free',
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      padding: '8px 12px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '12px',
    }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '2px' }}>
        {FOLDER_LABELS[name] || name}
      </div>
      <div style={{ color: 'var(--text-primary)' }}>{fmtBytes(value)}</div>
    </div>
  )
}

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      padding: '8px 12px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '12px',
    }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '2px' }}>{label}</div>
      <div style={{ color: 'var(--accent)' }}>{payload[0].value} GB saved</div>
    </div>
  )
}

export function DiskDonut({ folders }) {
  if (!folders || folders.length === 0) return null

  const ref = folders[0]
  const total = ref.total_bytes || 0
  const totalUsed = folders.reduce((a, f) => a + f.used_bytes, 0)

  const data = [
    ...folders.map((f) => ({ name: f.folder, value: f.used_bytes })),
    { name: 'free', value: Math.max(0, ref.free_bytes) },
  ].filter((d) => d.value > 0)

  const usedPct = total ? Math.round((totalUsed / total) * 100) : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
      {/* Donut */}
      <div style={{ position: 'relative', flexShrink: 0, width: 160, height: 160 }}>
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              cx={75}
              cy={75}
              innerRadius={50}
              outerRadius={72}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={FOLDER_COLORS[entry.name] || '#3a3a4a'} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: '22px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--accent)' }}>
            {usedPct}%
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            used
          </span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {folders.map((f) => (
          <div key={f.folder} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: FOLDER_COLORS[f.folder] || '#3a3a4a' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', width: '72px' }}>{FOLDER_LABELS[f.folder] || f.folder}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", marginLeft: 'auto' }}>
              {fmtBytes(f.used_bytes)}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: 'var(--border-bright)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '72px' }}>Free</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", marginLeft: 'auto' }}>
            {fmtBytes(ref.free_bytes)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function SavingsChart({ history }) {
  if (!history || history.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>No history yet</p>
      </div>
    )
  }

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  // Compute per-day delta (each bar = new savings that day, not cumulative total)
  const data = sorted.map((h, i) => {
    const prevSaved = i > 0 ? sorted[i - 1].saved_bytes : 0
    const delta = Math.max(0, h.saved_bytes - prevSaved)
    return {
      date: h.date.slice(5),
      saved: parseFloat((delta / 1e9).toFixed(2)),
    }
  })

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          unit=" GB"
        />
        <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(106,171,132,0.06)' }} />
        <Bar dataKey="saved" fill="var(--accent)" radius={[2, 2, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
