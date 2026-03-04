// cortex/frontend/src/components/rail/ActivityRail.tsx
import { Home, Layers, Cpu, Film, Network, LogOut } from 'lucide-react'
import { useUI, type Section } from '../../stores/ui'
import { useAuth } from '../../stores/auth'

function CortexLogo() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden>
      <polygon points="10,2 18,10 10,18 2,10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
      <circle cx="10" cy="10" r="2" fill="currentColor"/>
      <line x1="10" y1="4.5" x2="10" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="10" y1="12.5" x2="10" y2="15.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="4.5" y1="10" x2="7.5" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="12.5" y1="10" x2="15.5" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

const ITEMS: { id: Section; icon: React.ElementType; label: string }[] = [
  { id: 'home',     icon: Home,    label: 'Home'     },
  { id: 'services', icon: Layers,  label: 'Services' },
  { id: 'jobs',     icon: Cpu,     label: 'Jobs'     },
  { id: 'media',    icon: Film,    label: 'Media'    },
  { id: 'tunnels',  icon: Network, label: 'Tunnels'  },
]

export function ActivityRail() {
  const { section, setSection } = useUI()
  const { logout } = useAuth()

  return (
    <div className="flex flex-col items-center w-14 h-full border-r border-[var(--color-border)]
                    bg-[var(--color-surface)] py-4 gap-1 shrink-0">
      <div className="text-[var(--color-accent)] mb-4 select-none" title="Cortex">
        <CortexLogo />
      </div>

      {ITEMS.map(item => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            title={item.label}
            className={`group relative w-10 h-10 flex items-center justify-center
                        rounded transition-all duration-150
                        ${section === item.id
                          ? 'text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)]'
                        }`}
          >
            <Icon size={18} strokeWidth={section === item.id ? 2 : 1.5} />
            <span className="absolute left-10 px-2 py-1 text-[10px] mono bg-[var(--color-elevated)]
                             border border-[var(--color-border)] text-[var(--color-text-primary)]
                             whitespace-nowrap opacity-0 group-hover:opacity-100
                             pointer-events-none transition-opacity z-50">
              {item.label}
            </span>
            {section === item.id && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--color-accent)]" />
            )}
          </button>
        )
      })}

      <div className="flex-1" />

      <button
        onClick={logout}
        title="Logout"
        className="w-10 h-10 flex items-center justify-center rounded
                   text-[var(--color-text-muted)] hover:text-[var(--color-down)]
                   hover:bg-[var(--color-elevated)] transition-colors"
      >
        <LogOut size={17} strokeWidth={1.5} />
      </button>
    </div>
  )
}
