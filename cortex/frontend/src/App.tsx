// cortex/frontend/src/App.tsx
import { useEffect } from 'react'
import { useAuth } from './stores/auth'
import { useUI } from './stores/ui'
import { LoginScreen } from './components/LoginScreen'
import { ActivityRail } from './components/rail/ActivityRail'
import { Ticker } from './components/Ticker'
import { CommandPalette } from './components/palette/CommandPalette'
import { Home } from './sections/Home'
import { Services } from './sections/Services'
import { Jobs } from './sections/Jobs'
import { Media } from './sections/Media'
import { Tunnels } from './sections/Tunnels'

const SECTIONS = { home: Home, services: Services, jobs: Jobs, media: Media, tunnels: Tunnels }

export default function App() {
  const { authenticated, checking, check } = useAuth()
  const { section } = useUI()

  useEffect(() => { check() }, [check])

  if (checking) return null
  if (!authenticated) return <LoginScreen />

  const Section = SECTIONS[section]

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <ActivityRail />
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between px-5 h-11 border-b border-[var(--color-border)] shrink-0">
          <span className="mono text-xs text-[var(--color-text-muted)] tracking-widest">
            {section.toUpperCase()}
          </span>
          <div className="flex items-center gap-4">
            <Ticker />
            <span className="mono text-[10px] text-[var(--color-text-muted)]">⌘K</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <Section />
        </div>
      </div>
      <CommandPalette />
    </div>
  )
}
