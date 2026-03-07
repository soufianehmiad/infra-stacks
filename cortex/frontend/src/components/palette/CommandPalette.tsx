// cortex/frontend/src/components/palette/CommandPalette.tsx
import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { useUI, type Section } from '../../stores/ui'
import { useServicesStore } from '../../stores/services'

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
const modKey = isMac ? '⌘' : 'Ctrl'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const { setSection } = useUI()
  const { services } = useServicesStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!open) return null

  const navigate = (section: Section) => { setSection(section); setOpen(false) }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm"
         onClick={() => setOpen(false)}>
      <div className="w-[560px] border border-[var(--color-border)] bg-[var(--color-surface)]
                      shadow-2xl shadow-black/60" onClick={e => e.stopPropagation()}>
        <Command className="w-full" shouldFilter={true}>
          <Command.Input
            autoFocus
            placeholder="Search services, actions, sections..."
            className="w-full bg-transparent text-[13px] text-[var(--color-text-primary)]
                       px-4 py-3.5 outline-none border-b border-[var(--color-border)]
                       placeholder:text-[var(--color-text-muted)]"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="text-[12px] text-[var(--color-text-muted)] px-3 py-8 text-center">
              No results
            </Command.Empty>

            {services.length > 0 && (
              <Command.Group heading="Services"
                className="[&_[cmdk-group-heading]]:font-display [&_[cmdk-group-heading]]:text-[11px]
                           [&_[cmdk-group-heading]]:text-[var(--color-accent)]
                           [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2
                           [&_[cmdk-group-heading]]:tracking-[0.15em]">
                {services.map(s => (
                  <Command.Item
                    key={s.container_id}
                    value={`${s.name} ${s.type} ${s.category}`}
                    onSelect={() => {
                      const url = s.public_url ?? s.url
                      if (url) window.open(url, '_blank')
                      setOpen(false)
                    }}
                    className="flex items-center gap-3 text-[13px] text-[var(--color-text-primary)] px-3 py-2
                               cursor-pointer
                               data-[selected=true]:bg-[var(--color-accent-dim)]
                               data-[selected=true]:text-[var(--color-accent)]">
                    <span className={`dot ${s.status === 'running' ? 'dot-up' : 'dot-down'}`} />
                    <span className="flex-1">{s.name}</span>
                    {s.public_url && (
                      <span className="text-[var(--color-text-muted)] text-[11px] truncate max-w-48">
                        {s.public_url.replace('https://', '')}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Navigate"
              className="[&_[cmdk-group-heading]]:font-display [&_[cmdk-group-heading]]:text-[11px]
                         [&_[cmdk-group-heading]]:text-[var(--color-accent)]
                         [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2
                         [&_[cmdk-group-heading]]:tracking-[0.15em]">
              {(['home','services','kubernetes','jobs','media','tunnels'] as Section[]).map(s => (
                <Command.Item
                  key={s}
                  value={`go to ${s}`}
                  onSelect={() => navigate(s)}
                  className="text-[13px] text-[var(--color-text-primary)] px-3 py-2 cursor-pointer
                             data-[selected=true]:bg-[var(--color-accent-dim)]
                             data-[selected=true]:text-[var(--color-accent)]">
                  → {s}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Actions"
              className="[&_[cmdk-group-heading]]:font-display [&_[cmdk-group-heading]]:text-[11px]
                         [&_[cmdk-group-heading]]:text-[var(--color-accent)]
                         [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2
                         [&_[cmdk-group-heading]]:tracking-[0.15em]">
              <Command.Item value="scan media library" onSelect={async () => {
                await fetch('/encoder/scan', { method: 'POST' })
                setOpen(false)
              }} className="text-[13px] text-[var(--color-text-primary)] px-3 py-2 cursor-pointer
                            data-[selected=true]:bg-[var(--color-accent-dim)]
                            data-[selected=true]:text-[var(--color-accent)]">
                ▶ scan media library
              </Command.Item>
            </Command.Group>
          </Command.List>

          <div className="border-t border-[var(--color-border)] px-4 py-2.5 flex items-center justify-between">
            <span className="text-[11px] text-[var(--color-text-muted)]">Type to search</span>
            <span className="font-display text-[11px] text-[var(--color-text-muted)]">esc to close</span>
          </div>
        </Command>
      </div>
    </div>
  )
}

export { isMac, modKey }
