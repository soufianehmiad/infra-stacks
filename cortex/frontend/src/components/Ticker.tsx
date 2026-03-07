// cortex/frontend/src/components/Ticker.tsx
import { useEffect } from 'react'
import { useHeartbeat } from '../stores/heartbeat'

export function Ticker() {
  const { latest, connect } = useHeartbeat()

  useEffect(() => { connect() }, [connect])

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]
                    overflow-hidden max-w-xs">
      <span className="shrink-0 text-[var(--color-accent)]"
            style={{ textShadow: '0 0 6px rgba(34, 197, 94, 0.5)' }}>●</span>
      <span className="truncate">{latest ?? 'connected'}</span>
    </div>
  )
}
