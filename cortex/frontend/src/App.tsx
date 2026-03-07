// cortex/frontend/src/App.tsx
import { useEffect } from 'react'
import { useAuth } from './stores/auth'
import { useUI } from './stores/ui'
import { LoginScreen } from './components/LoginScreen'
import { ActivityRail } from './components/rail/ActivityRail'
import { CommandPalette } from './components/palette/CommandPalette'
import { Home } from './sections/Home'
import { Services } from './sections/Services'
import { Jobs } from './sections/Jobs'
import { Media } from './sections/Media'
import { Kubernetes } from './sections/Kubernetes'
import { Tunnels } from './sections/Tunnels'

const SECTIONS = { home: Home, services: Services, kubernetes: Kubernetes, jobs: Jobs, media: Media, tunnels: Tunnels }

export default function App() {
  const { authenticated, checking, check } = useAuth()
  const { section } = useUI()

  useEffect(() => { check() }, [check])

  if (checking) return null
  if (!authenticated) return <LoginScreen />

  const Section = SECTIONS[section]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-void)]">
      <ActivityRail />
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-hidden pb-16 sm:pb-0">
          <Section />
        </div>
      </div>
      <CommandPalette />
    </div>
  )
}
