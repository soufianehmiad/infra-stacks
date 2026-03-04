import React, { useEffect, useState, memo, useCallback } from 'react';
import {
  Activity, RefreshCw, ExternalLink, Lock, Cpu,
  Shield, Terminal, TrendingUp, BarChart3, AppWindow, LogOut
} from 'lucide-react';
import axios from 'axios';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- UTILS ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- TYPES ---
interface Service {
  id: string;
  name: string;
  container_name: string;
  type: string;
  proxy_path: string;
  status: string;
}

const CATEGORIES = {
  'Content Pipeline': ['sonarr', 'radarr', 'lidarr', 'prowlarr', 'readarr', 'bazarr'],
  'Traffic & Storage': ['qbittorrent', 'sabnzbd', 'deluge', 'transmission'],
  'Infrastructure': ['tautulli', 'plex', 'jellyfin', 'overseerr', 'portainer', 'homarr', 'flaresolverr']
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

// --- COMPONENTS ---

const NavMetric = ({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color: string }) => (
  <div className="flex items-center gap-3 px-4 h-full border-r-[2px] border-black group cursor-help transition-colors hover:bg-white/50">
    <div className={cn("p-1.5 rounded-sm border-[1.5px] border-black shadow-[1px_1px_0_#000]", color)}>
      <Icon size={12} strokeWidth={3} />
    </div>
    <div className="flex flex-col">
      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 leading-none mb-1">{label}</span>
      <span className="text-[11px] font-mono font-black text-black leading-none">{value}</span>
    </div>
  </div>
);

const PoolMetric = ({ name, usage, color }: { name: string, usage: number, color: string }) => (
  <div className="bg-white border-[2px] border-black p-3 shadow-[4px_4px_0_#000] flex flex-col gap-2">
    <div className="flex justify-between items-center">
      <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2 text-black text-left font-sans">
        <BarChart3 size={10} className="text-zinc-400" /> {name}
      </span>
      <span className="text-[10px] font-mono font-bold text-black">{usage}%</span>
    </div>
    <div className="h-1.5 bg-zinc-100 border border-black overflow-hidden p-[1px]">
      <div 
        className={cn("h-full transition-all duration-1000", color)} 
        style={{ width: `${usage}%` }} 
      />
    </div>
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
      className="brutalist-card-optimized gpu-layer flex flex-col justify-between min-h-[120px] p-4 relative group overflow-hidden w-full bg-white transition-all hover:-translate-y-1 hover:border-brutalist-accent"
    >
      {/* TRUE DUAL ASSET STRATEGY - NO FAKE COLORING */}
      {iconPath && (
        <>
          <img 
            src={iconPath} 
            alt=""
            className={cn(
              "absolute -right-4 -bottom-4 w-32 h-32 opacity-[0.08] rotate-12 pointer-events-none transform-gpu transition-all duration-500 select-none grayscale",
              "group-hover:opacity-0"
            )}
          />
          <img 
            src={iconPath} 
            alt=""
            className={cn(
              "absolute -right-4 -bottom-4 w-32 h-32 opacity-0 rotate-12 pointer-events-none transform-gpu transition-all duration-500 select-none",
              "group-hover:opacity-[0.25] group-hover:scale-110 group-hover:rotate-6"
            )}
          />
        </>
      )}
      
      <div className="absolute top-0 left-0 right-0 h-[3.5px] bg-brutalist-accent transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 transform-gpu" />
      
      <div className="relative z-10 flex flex-col gap-1.5">
        <div className="flex justify-between items-start">
          <div className="text-lg font-black uppercase tracking-tighter leading-none transition-colors truncate pr-2 text-black group-hover:text-brutalist-accent font-sans">
            {service.name}
          </div>
          <div className={cn(
            "px-1.5 py-0.5 border-[1.5px] border-black text-[8px] font-black uppercase tracking-widest shadow-[1px_1px_0_#000] font-sans",
            service.status === 'running' ? "bg-brutalist-success text-white" : "bg-brutalist-error text-white"
          )}>
            {service.status}
          </div>
        </div>
        <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-brutalist-text-dim flex items-center gap-1.5 opacity-70">
          <Terminal size={10} />
          <span className="truncate">{service.container_name}</span>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between mt-4 border-t border-zinc-100 pt-3 text-left font-sans">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 group-hover:text-zinc-600 transition-colors">{service.type}</span>
        <div className="w-6 h-6 rounded-full border-[1.5px] border-zinc-200 flex items-center justify-center transition-all duration-300 group-hover:border-black group-hover:bg-black">
          <ExternalLink size={10} className="text-zinc-300 group-hover:text-white transition-colors" />
        </div>
      </div>
    </a>
  );
});

const App: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/services.json?t=${new Date().getTime()}`);
      setServices(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setLoading(false), 400);
    }
  }, []);

  useEffect(() => {
    const auth = localStorage.getItem('unidash_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
      fetchServices();
    } else {
      setLoading(false);
    }
  }, [fetchServices]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin') {
      localStorage.setItem('unidash_auth', 'true');
      setIsAuthenticated(true);
      fetchServices();
    } else {
      setError('AUTH_REJECTED');
    }
  };

  const getCategorized = (catName: string) => {
    const types = (CATEGORIES as any)[catName];
    return services.filter(s => types.includes(s.type.toLowerCase()) || types.some((t: string) => s.container_name.toLowerCase().includes(t)));
  };

  const uncategorized = services.filter(s => !Object.values(CATEGORIES).flat().some(t => s.type.toLowerCase().includes(t) || s.container_name.toLowerCase().includes(t)));

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-brutalist-bg overflow-hidden flex-row font-sans">
        <div className="hidden lg:flex flex-1 bg-white relative items-center justify-center p-20 overflow-hidden border-r-[10px] border-black">
           <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '24px 24px' }} />
           <div className="relative z-10 w-full h-full flex flex-col items-center justify-center text-black text-left">
              <div className="w-[600px] h-[600px] drop-shadow-[20px_20px_0_rgba(0,0,0,0.1)]">
                 <img src="/login-art.svg" alt="Infrastructure Art" className="w-full h-full" />
              </div>
              <div className="mt-16 text-center">
                 <div className="inline-block bg-black text-white px-12 py-3 mb-6 shadow-[12px_12px_0_#d97706]">
                    <div className="text-5xl font-black uppercase tracking-[0.4em] italic leading-none">UNIDASH</div>
                 </div>
                 <p className="text-zinc-500 font-mono text-sm tracking-[0.4em] uppercase font-black opacity-60">System_Authenticated_Management</p>
              </div>
           </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 z-10 bg-brutalist-bg text-left">
          <div className="w-full max-w-[400px] bg-white border-[4px] border-black p-10 shadow-[20px_20px_0_#000] gpu-layer relative">
            <div className="absolute -top-6 -left-6 bg-brutalist-accent text-white border-[3px] border-black px-4 py-2 font-black uppercase italic tracking-widest shadow-[-4px_4px_0_#000] rotate-2 text-left">NODE_MOUNT</div>
            <div className="flex flex-col items-center mb-12">
              <div className="w-16 h-16 bg-black flex items-center justify-center text-white mb-6 transform rotate-3 hover:rotate-0 transition-transform shadow-[4px_4px_0_#d97706]"><Lock size={32} strokeWidth={2.5} /></div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-black text-center leading-none">Authentication</h1>
              <p className="mt-3 text-[10px] font-mono font-black uppercase bg-zinc-100 px-3 py-1 border border-black italic tracking-widest text-zinc-500 text-center">Identity_Sequence_Required</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-8 font-sans">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] px-1 text-zinc-400 font-black">Access Token ID</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-zinc-50 border-[3px] border-black p-4 font-mono text-lg text-black focus:outline-none focus:bg-white focus:border-brutalist-accent transition-all placeholder:text-zinc-200" placeholder="TOKEN_ID" autoFocus />
              </div>
              {error && <div className="text-white text-xs font-mono text-center uppercase font-black bg-brutalist-error border-[3px] border-black py-2 shadow-[4px_4px_0_#000] animate-bounce">{error}</div>}
              <button type="submit" className="w-full bg-black text-white p-5 text-sm font-black uppercase tracking-[0.2em] hover:bg-brutalist-accent transition-all active:translate-x-2 active:translate-y-2 active:shadow-none shadow-[8px_8px_0_#d97706]">Authorize Node</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brutalist-bg pb-20 selection:bg-black selection:text-white font-sans">
      {/* High-Performance Premium Topbar */}
      <header className="sticky top-0 z-50 h-16 lg:h-20 bg-white border-b-[4px] border-black px-0 flex items-center justify-between shadow-[0_4px_0_rgba(0,0,0,0.05)]">
        <div className="flex items-center h-full overflow-hidden">
          <div className="px-6 lg:px-10 flex flex-col justify-center border-r-[4px] border-black h-full bg-zinc-50/50 text-left">
            <h1 className="text-xl lg:text-3xl font-black uppercase tracking-tighter text-black leading-none">UniDash</h1>
            <span className="text-[9px] lg:text-[11px] font-mono font-black uppercase text-zinc-400 tracking-widest mt-1 italic whitespace-nowrap">Core Interface</span>
          </div>
          
          <div className="hidden xl:flex h-full">
            <NavMetric label="CPU Node" value="14.2%" icon={Cpu} color="bg-blue-50 text-blue-600" />
            <NavMetric label="RAM Stack" value="7.4Gi" icon={Activity} color="bg-emerald-50 text-emerald-600" />
            <NavMetric label="Host Age" value="11d 15h" icon={TrendingUp} color="bg-purple-50 text-purple-600" />
          </div>
        </div>
        
        <div className="flex items-center h-full gap-4 px-6 lg:px-10">
          <button 
            onClick={fetchServices} 
            disabled={loading}
            className={cn(
              "w-10 h-10 lg:w-12 lg:h-12 border-[2px] border-black flex items-center justify-center transition-all active:scale-95 shadow-[2px_2px_0_#000] text-black",
              loading ? "bg-zinc-100 opacity-50" : "bg-white hover:bg-black hover:text-white"
            )}
          >
            <RefreshCw size={20} className={cn(loading && "animate-spin")} />
          </button>
          
          <button
            onClick={() => { localStorage.removeItem('unidash_auth'); window.location.reload(); }}
            className="flex gap-2 border-[3px] border-black bg-brutalist-error text-white px-4 lg:px-6 h-10 lg:h-12 items-center justify-center text-[10px] lg:text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-[4px_4px_0_#000] active:shadow-none active:translate-x-1 active:translate-y-1"
          >
            <LogOut size={14} strokeWidth={3} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="max-w-[2400px] mx-auto p-6 lg:p-10 flex flex-col lg:flex-row gap-10">
        
        {/* Left Sidebar: Detailed Metrics */}
        <aside className="w-full lg:w-80 flex flex-col gap-6 order-2 lg:order-1 text-left">
           <div className="p-6 border-[3px] border-black bg-white shadow-[8px_8px_0_#000] space-y-8">
              <div className="space-y-4">
                 <div className="flex items-center gap-3 mb-2">
                    <BarChart3 size={18} strokeWidth={3} className="text-black" />
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-black font-sans">Infrastructure</h2>
                 </div>
                 {[
                   { name: 'data-pool', usage: 10, color: 'bg-emerald-500' },
                   { name: 'nvme-pool', usage: 0, color: 'bg-blue-500' },
                   { name: 'rpool', usage: 22, color: 'bg-amber-500' }
                 ].map(pool => (
                   <PoolMetric key={pool.name} name={pool.name} usage={pool.usage} color={pool.color} />
                 ))}
              </div>
              <div className="pt-6 border-t-[2px] border-black border-dashed">
                 <div className="flex items-center gap-3 mb-4">
                    <Shield size={18} className="text-blue-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-black font-sans">Network Status</span>
                 </div>
                 <div className="space-y-3">
                    {[
                      { id: 100, name: 'MGMT', ip: '10.99.0.1' },
                      { id: 110, name: 'MEDIA', ip: '10.99.0.10' },
                      { id: 150, name: 'DEV', ip: '10.99.0.50' }
                    ].map(node => (
                      <div key={node.id} className="flex justify-between items-center text-[10px] font-mono">
                         <span className="font-bold uppercase text-black">{node.name} <span className="text-zinc-300">[{node.id}]</span></span>
                         <span className="text-emerald-600 font-black">{node.ip}</span>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </aside>

        {/* Main Grid: Services */}
        <main className="flex-1 space-y-12 order-1 lg:order-2 text-left">
          {[...Object.keys(CATEGORIES), 'Unmapped'].map(cat => {
            const catServices = cat === 'Unmapped' ? uncategorized : getCategorized(cat);
            if (catServices.length === 0) return null;
            return (
              <div key={cat} className="space-y-5">
                <div className="flex items-center gap-5 text-left">
                  <div className="w-8 h-8 bg-zinc-100 border-[2.5px] border-black flex items-center justify-center shadow-[2px_2px_0_#000]">
                    <AppWindow size={16} strokeWidth={3} className="text-black" />
                  </div>
                  <h2 className="text-xs lg:text-sm font-black uppercase tracking-[4px] text-black whitespace-nowrap font-sans">{cat}</h2>
                  <div className="h-[3px] flex-1 bg-black opacity-[0.08]" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-5">
                  {catServices.map(svc => <ServiceCard key={svc.id} service={svc} />)}
                </div>
              </div>
            );
          })}
        </main>
      </div>
    </div>
  );
};

export default App;