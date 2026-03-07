// cortex/frontend/src/components/Drawer.tsx
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: string
}

export function Drawer({ open, onClose, title, children, width = 'w-96' }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      )}
      <div
        ref={ref}
        className={`fixed top-0 right-0 h-full z-50 ${width} max-w-[90vw]
                    bg-[var(--color-surface)] border-l border-[var(--color-border)]
                    shadow-2xl shadow-black/50
                    transform transition-transform duration-200 ease-out
                    ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
          {title && <span className="label-accent">{title}</span>}
          <button onClick={onClose}
                  className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]
                             hover:bg-[var(--color-elevated)] transition-colors ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto h-[calc(100%-60px)]">
          {children}
        </div>
      </div>
    </>
  )
}
