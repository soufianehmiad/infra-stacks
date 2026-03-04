import React, { memo, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  AppWindow,
  BarChart3,
  Cpu,
  ExternalLink,
  Film,
  Lock,
  LogOut,
  RefreshCw,
  Shield,
  Terminal,
  TrendingUp,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import MediaLayout from './pages/media/MediaLayout';
import MediaDashboard from './pages/media/Dashboard';
import MediaLibrary from './pages/media/Library';
import MediaJobs from './pages/media/Jobs';
import MediaCloudflare from './pages/media/Cloudflare';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Service {
  id: string;
  name: string;
  container_name: string;
  type: string;
  proxy_path: string;
  status?: string;
  hidden?: boolean;
}

interface LoginConfig {
  token?: string;
  tokens?: string[];
}

interface InfraNavMetric {
  label: string;
  value: string;
  icon?: string;
  color?: string;
}

interface InfraPoolMetric {
  name: string;
  usage: number;
  color?: string;
  detail?: string;
  detailLeft?: string;
  detailRight?: string;
}

interface InfraStat {
  label: string;
  value: string;
  icon?: string;
  color?: string;
}

interface InfraNode {
  id?: string | number;
  name: string;
  ip: string;
  status?: string;
}

interface InfraConfig {
  enabled?: boolean;
  navMetrics?: InfraNavMetric[];
  pools?: InfraPoolMetric[];
  network?: InfraNode[];
  stats?: InfraStat[];
}

const NAV_ICON_MAP: Record<string, any> = {
  cpu: Cpu,
  activity: Activity,
  ram: Activity,
  memory: Activity,
  trending: TrendingUp,
  uptime: TrendingUp,
  shield: Shield,
};

const CATEGORIES = {
  'Content Pipeline': ['sonarr', 'radarr', 'lidarr', 'prowlarr', 'readarr', 'bazarr'],
  'Traffic & Storage': ['qbittorrent', 'sabnzbd', 'deluge', 'transmission'],
  'Infrastructure': ['tautulli', 'plex', 'jellyfin', 'overseerr', 'portainer', 'homarr', 'flaresolverr'],
};

const ASSET_ICONS: Record<string, string> = {
  plex: '/icons/color/plex.svg',
  sonarr: '/icons/color/sonarr.svg',
  'sonarr-anime': '/icons/color/crunchyroll.svg',
  radarr: '/icons/color/radarr.svg',
  bazarr: '/icons/color/bazarr.svg',
  prowlarr: '/icons/color/prowlarr.svg',
  lidarr: '/icons/color/lidarr.svg',
  readarr: '/icons/color/readarr.svg',
  qbittorrent: '/icons/color/qbittorrent.svg',
  sabnzbd: '/icons/color/sabnzbd.svg',
  tautulli: '/icons/color/tautulli.svg',
  portainer: '/icons/color/portainer.svg',
  overseerr: '/icons/color/overseerr.svg',
  jellyfin: '/icons/color/jellyfin.svg',
  homarr: '/icons/color/homarr.svg',
  flaresolverr: '/icons/color/flaresolverr.svg',
};

const PoolMetric = ({
  name,
  usage,
  color,
  detail,
  detailLeft,
  detailRight,
}: {
  name: string;
  usage: number;
  color: string;
  detail?: string;
  detailLeft?: string;
  detailRight?: string;
}) => (
  <div className="bg-zinc-900 border-[2px] border-zinc-700 p-3 shadow-[4px_4px_0_#000] flex flex-col gap-2">
    <div className="flex justify-between items-center">
      <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-zinc-200 text-left font-sans">
        <BarChart3 size={10} className="text-zinc-400" /> {name}
      </span>
      <span className="text-[11px] font-mono font-bold text-zinc-200">{usage}%</span>
    </div>
    {(detailLeft || detailRight || detail) && (
      <div className="flex items-center justify-between text-[12px] text-zinc-500 font-mono">
        <span className="truncate">{detailLeft ?? detail ?? ''}</span>
        {detailRight && <span className="ml-3 shrink-0 text-right">{detailRight}</span>}
      </div>
    )}
    <div className="h-1.5 bg-zinc-800 border border-zinc-700 overflow-hidden p-[1px]">
      <div className={cn('h-full transition-all duration-1000', color)} style={{ width: `${usage}%` }} />
    </div>
  </div>
);

const SidebarMetric = ({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: any;
  color: string;
}) => (
  <div className="flex items-center justify-between gap-3 border-[2px] border-zinc-700 bg-zinc-900 px-4 py-3 shadow-[3px_3px_0_#000]">
    <div className="flex items-center gap-3">
      <div className={cn('p-1.5 rounded-sm border-[1.5px] border-zinc-700 shadow-[1px_1px_0_#000]', color)}>
        <Icon size={12} strokeWidth={3} />
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 font-sans">{label}</span>
    </div>
    <span className="text-[12px] font-mono font-black text-zinc-200 whitespace-nowrap">{value}</span>
  </div>
);

const ServiceCard = memo(({ service }: { service: Service }) => {
  const brandKey = service.container_name.toLowerCase().includes('anime') ? 'sonarr-anime' : service.type.toLowerCase();
  const iconPath = ASSET_ICONS[brandKey] || ASSET_ICONS[service.name.toLowerCase().split(' ')[0]];

  return (
    <a
      href={service.proxy_path || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="brutalist-card-optimized gpu-layer flex flex-col justify-between min-h-[120px] p-4 relative group overflow-hidden w-full bg-zinc-900 transition-all hover:-translate-y-1 hover:border-brutalist-accent"
    >
      {iconPath && (
        <>
          <img
            src={iconPath}
            alt=""
            className={cn(
              'absolute -right-4 -bottom-4 w-32 h-32 opacity-[0.12] rotate-12 pointer-events-none transform-gpu transition-all duration-500 select-none grayscale',
              'group-hover:opacity-0',
            )}
          />
          <img
            src={iconPath}
            alt=""
            className={cn(
              'absolute -right-4 -bottom-4 w-32 h-32 opacity-0 rotate-12 pointer-events-none transform-gpu transition-all duration-500 select-none',
              'group-hover:opacity-[0.25] group-hover:scale-110 group-hover:rotate-6',
            )}
          />
        </>
      )}

      <div className="absolute top-0 left-0 right-0 h-[3.5px] bg-brutalist-accent transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 transform-gpu" />

      <div className="relative z-10 flex flex-col gap-1.5">
        <div className="flex justify-between items-start">
          <div className="text-lg font-black uppercase tracking-tighter leading-none transition-colors truncate pr-2 text-zinc-100 group-hover:text-brutalist-accent font-sans">
            {service.name}
          </div>
          <div
            className={cn(
              'px-1.5 py-0.5 border-[1.5px] border-zinc-700 text-[8px] font-black uppercase tracking-widest shadow-[1px_1px_0_#000] font-sans',
              (service.status ?? 'running') === 'running' ? 'bg-brutalist-success text-white' : 'bg-brutalist-error text-white',
            )}
          >
            {service.status ?? 'running'}
          </div>
        </div>
        <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-brutalist-text-dim flex items-center gap-1.5 opacity-70">
          <Terminal size={10} />
          <span className="truncate">{service.container_name}</span>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between mt-4 border-t border-zinc-800 pt-3 text-left font-sans">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 group-hover:text-zinc-400 transition-colors">
          {service.type}
        </span>
        <div className="w-6 h-6 rounded-full border-[1.5px] border-zinc-700 flex items-center justify-center transition-all duration-300 group-hover:border-brutalist-accent group-hover:bg-brutalist-accent">
          <ExternalLink size={10} className="text-zinc-500 group-hover:text-black transition-colors" />
        </div>
      </div>
    </a>
  );
});

// ─── Services Dashboard ──────────────────────────────────────────────────────

function ServicesDashboard({
  services,
  infraConfig,
}: {
  services: Service[];
  infraConfig: InfraConfig | null;
}) {
  const visibleServices = services.filter((s) => !s.hidden);
  const getCategorized = (catName: string) => {
    const types = (CATEGORIES as any)[catName] as string[];
    return visibleServices.filter(
      (s) => types.includes(s.type.toLowerCase()) || types.some((t) => s.container_name.toLowerCase().includes(t)),
    );
  };

  const uncategorized = visibleServices.filter(
    (s) =>
      !Object.values(CATEGORIES)
        .flat()
        .some((t) => s.type.toLowerCase().includes(t) || s.container_name.toLowerCase().includes(t)),
  );
  const infraEnabled = Boolean(infraConfig?.enabled);
  const navMetrics = infraEnabled ? infraConfig?.navMetrics ?? [] : [];
  const poolMetrics = infraEnabled ? infraConfig?.pools ?? [] : [];
  const networkNodes = infraEnabled ? infraConfig?.network ?? [] : [];
  const statItems = infraEnabled ? infraConfig?.stats ?? [] : [];
  const showSidebar =
    poolMetrics.length > 0 || networkNodes.length > 0 || navMetrics.length > 0 || statItems.length > 0;

  return (
    <div className="max-w-[2400px] mx-auto p-6 lg:p-10 flex flex-col lg:flex-row gap-10">
      {showSidebar && (
        <aside className="w-full lg:w-80 flex flex-col gap-6 order-2 lg:order-1 text-left">
          <div className="p-6 border-[3px] border-zinc-700 bg-zinc-900 shadow-[8px_8px_0_#000] space-y-8">
            {navMetrics.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Cpu size={18} strokeWidth={3} className="text-zinc-200" />
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-200 font-sans">System</h2>
                </div>
                <div className="space-y-3">
                  {navMetrics.map((metric, idx) => {
                    const iconKey = metric.icon?.toLowerCase() ?? 'activity';
                    const Icon = NAV_ICON_MAP[iconKey] ?? Activity;
                    const color = metric.color?.trim() || 'bg-zinc-800 text-zinc-400';
                    return (
                      <SidebarMetric
                        key={`${metric.label}-${idx}`}
                        label={metric.label}
                        value={metric.value}
                        icon={Icon}
                        color={color}
                      />
                    );
                  })}
                </div>
              </div>
            )}
            {poolMetrics.length > 0 && (
              <div className={cn('space-y-4', navMetrics.length > 0 && 'pt-6 border-t-[2px] border-zinc-700 border-dashed')}>
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 size={18} strokeWidth={3} className="text-zinc-200" />
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-200 font-sans">Infrastructure</h2>
                </div>
                {poolMetrics.map((pool, idx) => {
                  const usage = Math.max(0, Math.min(100, pool.usage));
                  const color = pool.color?.trim() || 'bg-emerald-500';
                  const detailLeft = (pool as any).detailLeft ?? (pool as any).detail_left;
                  const detailRight = (pool as any).detailRight ?? (pool as any).detail_right;
                  return (
                    <PoolMetric
                      key={`${pool.name}-${idx}`}
                      name={pool.name}
                      usage={usage}
                      color={color}
                      detail={pool.detail}
                      detailLeft={detailLeft}
                      detailRight={detailRight}
                    />
                  );
                })}
              </div>
            )}

            {statItems.length > 0 && (
              <div
                className={cn(
                  (poolMetrics.length > 0 || navMetrics.length > 0) && 'pt-6 border-t-[2px] border-zinc-700 border-dashed',
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Terminal size={18} className="text-purple-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-200 font-sans">Operations</span>
                </div>
                <div className="space-y-3">
                  {statItems.map((stat, idx) => {
                    const iconKey = stat.icon?.toLowerCase() ?? 'activity';
                    const Icon = NAV_ICON_MAP[iconKey] ?? Activity;
                    const color = stat.color?.trim() || 'bg-zinc-800 text-zinc-400';
                    return (
                      <SidebarMetric
                        key={`${stat.label}-${idx}`}
                        label={stat.label}
                        value={stat.value}
                        icon={Icon}
                        color={color}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {networkNodes.length > 0 && (
              <div
                className={cn(
                  (poolMetrics.length > 0 || navMetrics.length > 0 || statItems.length > 0) &&
                    'pt-6 border-t-[2px] border-zinc-700 border-dashed',
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Shield size={18} className="text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-200 font-sans">Network Status</span>
                </div>
                <div className="space-y-3">
                  {networkNodes.map((node, idx) => {
                    const status = node.status?.toLowerCase() ?? 'ok';
                    const statusClass =
                      status === 'down' ? 'text-red-400' : status === 'warn' ? 'text-amber-400' : 'text-emerald-400';
                    return (
                      <div key={`${node.id ?? node.name}-${idx}`} className="flex justify-between items-center text-[10px] font-mono">
                        <span className="font-bold uppercase text-zinc-200">
                          {node.name}
                          {node.id !== undefined && <span className="text-zinc-600"> [{node.id}]</span>}
                        </span>
                        <span className={cn('font-black', statusClass)}>{node.ip}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      <main className="flex-1 space-y-12 order-1 lg:order-2 text-left">
        {[...Object.keys(CATEGORIES), 'Unmapped'].map((cat) => {
          const catServices = cat === 'Unmapped' ? uncategorized : getCategorized(cat);
          if (catServices.length === 0) return null;
          return (
            <div key={cat} className="space-y-5">
              <div className="flex items-center gap-5 text-left">
                <div className="w-8 h-8 bg-zinc-800 border-[2.5px] border-zinc-700 flex items-center justify-center shadow-[2px_2px_0_#000]">
                  <AppWindow size={16} strokeWidth={3} className="text-zinc-200" />
                </div>
                <h2 className="text-xs lg:text-sm font-black uppercase tracking-[4px] text-zinc-200 whitespace-nowrap font-sans">{cat}</h2>
                <div className="h-[3px] flex-1 bg-zinc-800" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-5">
                {catServices.map((svc) => (
                  <ServiceCard key={svc.id} service={svc} />
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) {
  const location = useLocation();
  const isMedia = location.pathname.startsWith('/media');

  return (
    <header className="sticky top-0 z-50 h-16 lg:h-20 bg-zinc-900 border-b-[4px] border-zinc-700 px-0 flex items-center justify-between shadow-[0_4px_0_rgba(0,0,0,0.3)]">
      <div className="flex items-center h-full overflow-hidden">
        <div className="px-6 lg:px-10 flex flex-col justify-center border-r-[4px] border-zinc-700 h-full bg-black/30 text-left">
          <h1 className="text-xl lg:text-3xl font-black uppercase tracking-tighter text-zinc-100 leading-none">UniDash</h1>
          <span className="text-[9px] lg:text-[11px] font-mono font-black uppercase text-zinc-500 tracking-widest mt-1 italic whitespace-nowrap">
            Core Interface
          </span>
        </div>

        {/* Nav tabs */}
        <div className="flex items-center h-full">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              cn(
                'px-5 lg:px-8 h-full text-[10px] font-black uppercase tracking-[3px] border-r-[3px] border-zinc-700 transition-all flex items-center gap-2',
                isActive && !isMedia ? 'bg-brutalist-accent text-black' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
              )
            }
          >
            <AppWindow size={13} strokeWidth={3} />
            Services
          </NavLink>
          <NavLink
            to="/media"
            className={({ isActive }) =>
              cn(
                'px-5 lg:px-8 h-full text-[10px] font-black uppercase tracking-[3px] border-r-[3px] border-zinc-700 transition-all flex items-center gap-2',
                isActive ? 'bg-brutalist-accent text-black' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
              )
            }
          >
            <Film size={13} strokeWidth={3} />
            MediaMgr
          </NavLink>
        </div>
      </div>

      <div className="flex items-center h-full gap-4 px-6 lg:px-10">
        <button
          onClick={onRefresh}
          disabled={loading}
          className={cn(
            'w-10 h-10 lg:w-12 lg:h-12 border-[2px] border-zinc-700 flex items-center justify-center transition-all active:scale-95 shadow-[2px_2px_0_#000] text-zinc-200',
            loading ? 'bg-zinc-800 opacity-50' : 'bg-zinc-800 hover:bg-brutalist-accent hover:text-black hover:border-brutalist-accent',
          )}
          title="Refresh"
        >
          <RefreshCw size={20} className={cn(loading && 'animate-spin')} />
        </button>

        <button
          onClick={async () => {
            localStorage.removeItem('unidash_auth');
            document.cookie = 'unidash_auth=; Path=/; Max-Age=0; SameSite=Lax';
            try {
              await fetch('/mediamgr/auth/logout', { method: 'POST' });
            } catch {}
            window.location.href = '/';
          }}
          className="flex gap-2 border-[3px] border-zinc-700 bg-brutalist-error text-white px-4 lg:px-6 h-10 lg:h-12 items-center justify-center text-[10px] lg:text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-[4px_4px_0_#000] active:shadow-none active:translate-x-1 active:translate-y-1"
          title="Logout"
        >
          <LogOut size={14} strokeWidth={3} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [allowedTokens, setAllowedTokens] = useState<string[] | null>(null);
  const [infraConfig, setInfraConfig] = useState<InfraConfig | null>(null);
  const loginArtUrl = '/login-art.svg?v=20260203h';

  const getCookie = (name: string) => {
    const prefix = `${name}=`;
    const parts = document.cookie.split(';').map((p) => p.trim());
    for (const p of parts) {
      if (p.startsWith(prefix)) return p.slice(prefix.length);
    }
    return null;
  };

  const setAuthCookie = (enabled: boolean) => {
    if (enabled) {
      document.cookie = `unidash_auth=1; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`;
    } else {
      document.cookie = 'unidash_auth=; Path=/; Max-Age=0; SameSite=Lax';
    }
  };

  const safeNextPath = () => {
    const next = new URLSearchParams(window.location.search).get('next');
    if (!next) return null;
    if (!next.startsWith('/')) return null;
    if (next.startsWith('//')) return null;
    return next;
  };

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/services.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(`services.json HTTP ${res.status}`);
      const data = (await res.json()) as Service[];
      setServices(Array.isArray(data) ? data : []);
    } catch (err) {
      setServices([]);
    } finally {
      setTimeout(() => setLoading(false), 400);
    }
  }, []);

  useEffect(() => {
    const loadLoginConfig = async () => {
      try {
        const res = await fetch(`/login.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = (await res.json()) as LoginConfig;
        if (typeof data.token === 'string' && data.token.trim()) {
          setAllowedTokens([data.token]);
          return;
        }
        if (Array.isArray(data.tokens)) {
          const tokens = data.tokens.filter((t) => typeof t === 'string' && t.trim());
          if (tokens.length) setAllowedTokens(tokens);
        }
      } catch (err) {
        // Ignore
      }
    };
    loadLoginConfig();
  }, []);

  useEffect(() => {
    const loadInfraConfig = async () => {
      try {
        const res = await fetch(`/infra.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = (await res.json()) as InfraConfig;
        if (!data || typeof data !== 'object') return;
        const enabled = data.enabled === undefined ? true : Boolean(data.enabled);
        const navMetrics = Array.isArray(data.navMetrics)
          ? data.navMetrics.filter((m) => m && typeof m.label === 'string' && typeof m.value === 'string')
          : [];
        const pools = Array.isArray(data.pools)
          ? data.pools.filter((p) => p && typeof p.name === 'string' && typeof p.usage === 'number')
          : [];
        const network = Array.isArray(data.network)
          ? data.network.filter((n) => n && typeof n.name === 'string' && typeof n.ip === 'string')
          : [];
        const stats = Array.isArray(data.stats)
          ? data.stats.filter((s) => s && typeof s.label === 'string' && typeof s.value === 'string')
          : [];
        setInfraConfig({ enabled, navMetrics, pools, network, stats });
      } catch (err) {
        // Ignore
      }
    };
    loadInfraConfig();
  }, []);

  useEffect(() => {
    const auth = localStorage.getItem('unidash_auth');
    const cookieAuth = getCookie('unidash_auth');
    if (auth === 'true' || cookieAuth === '1') {
      setIsAuthenticated(true);
      fetchServices();
    } else {
      setLoading(false);
    }
  }, [fetchServices]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const tokens = allowedTokens ?? ['admin'];
    if (tokens.includes(password)) {
      localStorage.setItem('unidash_auth', 'true');
      setAuthCookie(true);
      setIsAuthenticated(true);
      setError('');
      const next = safeNextPath();
      if (next) {
        window.location.href = next;
        return;
      }
      fetchServices();
    } else {
      setError('AUTH_REJECTED');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-brutalist-bg overflow-hidden flex-row font-sans">
        <div className="hidden lg:flex flex-1 bg-black relative items-center justify-center p-20 overflow-hidden border-r-[10px] border-zinc-700">
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center text-zinc-100 text-left">
              <div className="w-[600px] h-[600px] drop-shadow-[20px_20px_0_rgba(0,0,0,0.3)]">
              <img src={loginArtUrl} alt="Login Art" className="w-full h-full" />
              </div>
            <div className="mt-16 text-center">
              <div className="inline-block bg-brutalist-accent text-black px-12 py-3 mb-6 shadow-[12px_12px_0_rgba(0,0,0,0.5)]">
                <div className="text-5xl font-black uppercase tracking-[0.4em] italic leading-none">UNIDASH</div>
              </div>
              <p className="text-zinc-500 font-mono text-sm tracking-[0.4em] uppercase font-black opacity-60">
                System_Authenticated_Management
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 z-10 bg-brutalist-bg text-left">
          <div className="w-full max-w-[400px] bg-zinc-900 border-[4px] border-zinc-700 p-10 shadow-[20px_20px_0_#000] gpu-layer relative">
            <div className="absolute -top-6 -left-6 bg-brutalist-accent text-black border-[3px] border-zinc-700 px-4 py-2 font-black uppercase italic tracking-widest shadow-[-4px_4px_0_#000] rotate-2 text-left">
              NODE_MOUNT
            </div>
            <div className="flex flex-col items-center mb-12">
              <div className="w-16 h-16 bg-brutalist-accent flex items-center justify-center text-black mb-6 transform rotate-3 hover:rotate-0 transition-transform shadow-[4px_4px_0_#000]">
                <Lock size={32} strokeWidth={2.5} />
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-zinc-100 text-center leading-none">Authentication</h1>
              <p className="mt-3 text-[10px] font-mono font-black uppercase bg-zinc-800 px-3 py-1 border border-zinc-700 italic tracking-widest text-zinc-500 text-center">
                Identity_Sequence_Required
              </p>
            </div>
            <form onSubmit={handleLogin} className="space-y-8 font-sans">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] px-1 text-zinc-500">Access Token ID</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-zinc-800 border-[3px] border-zinc-700 p-4 font-mono text-lg text-zinc-100 focus:outline-none focus:bg-zinc-700 focus:border-brutalist-accent transition-all placeholder:text-zinc-600 disabled:opacity-50"
                  placeholder="TOKEN_ID"
                  autoFocus
                />
              </div>
              {error && (
                <div className="text-white text-xs font-mono text-center uppercase font-black bg-brutalist-error border-[3px] border-zinc-700 py-2 shadow-[4px_4px_0_#000] animate-bounce">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brutalist-accent text-black p-5 text-sm font-black uppercase tracking-[0.2em] hover:bg-amber-600 transition-all active:translate-x-2 active:translate-y-2 active:shadow-none shadow-[8px_8px_0_#000] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Authorizing...' : 'Authorize Node'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-brutalist-bg selection:bg-brutalist-accent selection:text-black font-sans">
        <Header loading={loading} onRefresh={fetchServices} />

        <Routes>
          <Route path="/" element={<ServicesDashboard services={services} infraConfig={infraConfig} />} />
          <Route path="/media" element={<MediaLayout />}>
            <Route index element={<MediaDashboard />} />
            <Route path="library" element={<MediaLibrary />} />
            <Route path="jobs" element={<MediaJobs />} />
            <Route path="cloudflare" element={<MediaCloudflare />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
