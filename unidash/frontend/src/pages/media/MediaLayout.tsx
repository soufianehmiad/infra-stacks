import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, Film, HardDrive, Radio } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/media', label: 'Dashboard', icon: BarChart3, end: true },
  { to: '/media/library', label: 'Library', icon: HardDrive },
  { to: '/media/jobs', label: 'Jobs', icon: Film },
  { to: '/media/cloudflare', label: 'Cloudflare', icon: Radio },
];

export default function MediaLayout() {
  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Sidebar */}
      <aside className="w-[200px] shrink-0 bg-zinc-900 border-r-[3px] border-black flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b-[2px] border-zinc-800">
          <div className="text-[18px] font-black uppercase tracking-tight text-zinc-100">MediaMgr</div>
          <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Media Library Manager</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2 mx-2 my-0.5 text-[13px] font-medium transition-all ${
                  isActive
                    ? 'text-brutalist-accent bg-brutalist-accent/10 border-l-[3px] border-l-brutalist-accent pl-[13px]'
                    : 'text-zinc-400 border-l-[3px] border-l-transparent hover:text-zinc-200 hover:bg-zinc-800/50'
                }`
              }
            >
              <Icon size={14} strokeWidth={2.5} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Status */}
        <MediaStatus />
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-zinc-950 h-full">
        <div className="p-8 min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function MediaStatus() {
  return (
    <div className="px-5 py-3 border-t-[2px] border-zinc-800 flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-[11px] font-mono text-zinc-500">Connected</span>
    </div>
  );
}
