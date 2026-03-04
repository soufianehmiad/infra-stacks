// cortex/frontend/src/components/palette/CommandPalette.tsx
import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { useUI, type Section } from '../../stores/ui'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const { setSection } = useUI()

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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-32"
         onClick={() => setOpen(false)}>
      <div className="w-[520px] tile shadow-2xl" onClick={e => e.stopPropagation()}>
        <Command className="w-full">
          <Command.Input
            autoFocus
            placeholder="Search services, actions, sections..."
            className="w-full bg-transparent mono text-sm text-[var(--color-text-primary)]
                       px-4 py-3 outline-none border-b border-[var(--color-border)]
                       placeholder:text-[var(--color-text-muted)]"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="mono text-[10px] text-[var(--color-text-muted)] px-3 py-6 text-center">
              No results
            </Command.Empty>

            <Command.Group heading="Navigate"
              className="[&_[cmdk-group-heading]]:mono [&_[cmdk-group-heading]]:text-[9px]
                         [&_[cmdk-group-heading]]:text-[var(--color-text-muted)]
                         [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2
                         [&_[cmdk-group-heading]]:tracking-widest">
              {(['home','services','jobs','media','tunnels'] as Section[]).map(s => (
                <Command.Item
                  key={s}
                  value={s}
                  onSelect={() => navigate(s)}
                  className="mono text-xs text-[var(--color-text-primary)] px-3 py-2 cursor-pointer
                             data-[selected=true]:bg-[var(--color-accent-dim)]
                             data-[selected=true]:text-[var(--color-accent)]">
                  → {s}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Actions">
              <Command.Item value="scan media" onSelect={async () => {
                await fetch('/encoder/scan', { method: 'POST' })
                setOpen(false)
              }} className="mono text-xs text-[var(--color-text-primary)] px-3 py-2 cursor-pointer
                            data-[selected=true]:bg-[var(--color-accent-dim)]">
                ▶ scan media library
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
