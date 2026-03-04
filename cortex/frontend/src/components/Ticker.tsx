// cortex/frontend/src/components/Ticker.tsx
import { useEffect } from 'react'
import { useHeartbeat } from '../stores/heartbeat'

export function Ticker() {
  const { latest, connect } = useHeartbeat()

  useEffect(() => { connect() }, [connect])

  return (
    <div className="flex items-center gap-2 mono text-[10px] text-[var(--color-text-muted)]
                    overflow-hidden max-w-xs">
      <span className="shrink-0 text-[var(--color-accent)]">●</span>
      <span className="truncate">{latest ?? 'connected · waiting for events'}</span>
    </div>
  )
}
