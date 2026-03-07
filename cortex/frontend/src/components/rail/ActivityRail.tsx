// cortex/frontend/src/components/rail/ActivityRail.tsx
import { Home, Layers, Box, Cpu, Film, Network, LogOut } from 'lucide-react'
import { useUI, type Section } from '../../stores/ui'
import { useAuth } from '../../stores/auth'

const ITEMS: { id: Section; icon: React.ElementType; label: string }[] = [
  { id: 'home',       icon: Home,    label: 'Dashboard'  },
  { id: 'services',   icon: Layers,  label: 'Services'   },
  { id: 'kubernetes', icon: Box,     label: 'Kubernetes'  },
  { id: 'jobs',       icon: Cpu,     label: 'Jobs'        },
  { id: 'media',      icon: Film,    label: 'Media'       },
  { id: 'tunnels',    icon: Network, label: 'Tunnels'     },
]

export function ActivityRail() {
  const { section, setSection } = useUI()
  const { logout } = useAuth()

  return (
    <>
      {/* Desktop rail */}
      <div className="hidden sm:flex flex-col w-[180px] h-full border-r border-[var(--color-border)]
                      bg-[var(--color-surface)] py-4 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 mb-6">
          <div className="text-[var(--color-accent)]"
               style={{ filter: 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.4))' }}>
            <svg viewBox="0 0 20 20" fill="none" className="w-[18px] h-[18px]" aria-hidden>
              <polygon points="10,2 18,10 10,18 2,10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
              <circle cx="10" cy="10" r="2" fill="currentColor"/>
              <line x1="10" y1="4.5" x2="10" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="10" y1="12.5" x2="10" y2="15.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="4.5" y1="10" x2="7.5" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="12.5" y1="10" x2="15.5" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-display text-[11px] text-[var(--color-accent)] tracking-[0.2em] font-semibold"
                style={{ textShadow: '0 0 10px rgba(34, 197, 94, 0.3)' }}>CORTEX</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-3">
          {ITEMS.map(item => {
            const Icon = item.icon
            const active = section === item.id
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-150
                  ${active
                    ? 'text-[var(--color-accent)] bg-[var(--color-accent-dim)] border-l-2 border-[var(--color-accent)] -ml-px'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)]'}`}
              >
                <Icon size={15} strokeWidth={active ? 2 : 1.5} />
                <span className="text-[12px] tracking-wide">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="flex-1" />

        {/* Logout */}
        <div className="px-3">
          <button
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2 w-full
                       text-[var(--color-text-muted)] hover:text-[var(--color-down)]
                       hover:bg-[var(--color-elevated)] transition-colors text-[12px]"
          >
            <LogOut size={14} strokeWidth={1.5} />
            Logout
          </button>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--color-border)]
                      bg-[var(--color-surface)] flex justify-around py-1 safe-area-bottom">
        {ITEMS.map(item => {
          const Icon = item.icon
          const active = section === item.id
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 transition-colors
                ${active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
            >
              <Icon size={18} strokeWidth={active ? 2 : 1.5} />
              <span className="font-display text-[9px] tracking-wider">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
