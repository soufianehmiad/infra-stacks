import { useEffect, useState } from 'react';
import { mediaApi, mediaCf, fmtBytes } from '../../lib/media-api';
import { DiskDonut, SavingsChart } from '../../components/media/StorageCharts';
import type { StorageResponse, StorageHistoryEntry, Job, CfTunnel } from '../../types/media';

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-zinc-500',
  running: 'text-brutalist-accent',
  done: 'text-emerald-500',
  failed: 'text-red-500',
  reverted: 'text-amber-500',
  cancelled: 'text-zinc-500',
};

const ACTION_LABELS: Record<string, string> = {
  reencode: 'Re-encode',
  remux: 'Remux',
  downscale: 'Downscale',
  delete: 'Delete',
};

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border-[2px] border-zinc-700 shadow-[4px_4px_0_#000]">
      <div className="px-4 py-2.5 border-b-[2px] border-zinc-700 flex items-center gap-2">
        <span className="text-[9px] font-mono font-black uppercase tracking-[0.15em] text-zinc-500">{label}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function MiniStat({ index, label, value, accent }: { index: number; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 py-2 border-b border-zinc-800">
      <span className="text-[9px] font-mono text-zinc-600 w-[14px] shrink-0">{String(index).padStart(2, '0')}</span>
      <span className="text-[11px] text-zinc-500 flex-1">{label}</span>
      <span className={`text-[13px] font-mono font-semibold ${accent ? 'text-brutalist-accent' : 'text-zinc-200'}`}>{value}</span>
    </div>
  );
}

export default function MediaDashboard() {
  const [storage, setStorage] = useState<StorageResponse | null>(null);
  const [history, setHistory] = useState<StorageHistoryEntry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [cfTunnels, setCfTunnels] = useState<CfTunnel[] | null>(null);

  async function load() {
    try {
      const [s, h, j] = await Promise.all([mediaApi.storage(), mediaApi.storageHistory(), mediaApi.jobs()]);
      setStorage(s);
      setHistory(h);
      setJobs(j);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadCf() {
    try {
      setCfTunnels(await mediaCf.tunnels());
    } catch {
      setCfTunnels([]);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    loadCf();
    const t = setInterval(loadCf, 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-brutalist-accent animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  const stats = storage?.stats || { files_count: 0, jobs_count: 0, pending_jobs: 0, saved_bytes: 0 };
  const folders = storage?.folders || [];
  const saved = fmtBytes(stats.saved_bytes || 0);
  const recent = jobs.slice(0, 12);

  const savedParts = saved.split(' ');
  const savedNum = savedParts[0] || '0';
  const savedUnit = savedParts[1] || 'B';

  return (
    <div className="flex flex-col gap-0">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-black uppercase tracking-tight text-zinc-100 leading-none">Dashboard</h1>
          <p className="text-[11px] font-mono text-zinc-500 mt-1">System overview</p>
        </div>
        <span className="text-[11px] font-mono text-zinc-600">
          {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-[220px_1fr] gap-4">
        {/* Left column */}
        <div className="bg-black border-[2px] border-zinc-700 p-5 shadow-[4px_4px_0_#000]">
          <div className="text-[9px] font-mono font-black uppercase tracking-[0.15em] text-zinc-500 mb-2">Space Recovered</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[60px] font-black leading-none tracking-tighter text-brutalist-accent">{savedNum}</span>
            <span className="text-[17px] font-semibold text-brutalist-accent/70 self-end mb-2">{savedUnit}</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">saved vs original size</div>

          {/* System stats */}
          <div className="flex items-center gap-2 mt-6 mb-4">
            <span className="text-[9px] font-mono font-black uppercase tracking-[0.15em] text-zinc-500 shrink-0">System</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>
          <MiniStat index={1} label="Files indexed" value={stats.files_count?.toLocaleString() || '0'} />
          <MiniStat index={2} label="Jobs completed" value={stats.jobs_count?.toLocaleString() || '0'} />
          <MiniStat index={3} label="Queue depth" value={stats.pending_jobs || '0'} accent={stats.pending_jobs > 0} />

          {/* Volumes */}
          {folders.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-6 mb-4">
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.15em] text-zinc-500 shrink-0">Volumes</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>
              {folders.map((f) => {
                const pct = f.total_bytes ? Math.min(100, (f.used_bytes / f.total_bytes) * 100) : 0;
                return (
                  <div key={f.folder} className="mb-2">
                    <div className="flex justify-between mb-1">
                      <span className="text-[11px] text-zinc-500 capitalize">{f.folder}</span>
                      <span className="text-[11px] font-mono text-zinc-500">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-[2px] bg-zinc-800 relative">
                      <div className="absolute left-0 top-0 h-full bg-brutalist-accent transition-all duration-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Right: charts */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Panel label="Disk Usage">
              <DiskDonut folders={folders} />
            </Panel>
            <Panel label="Space Recovered \u2014 30 Days">
              <SavingsChart history={history} />
            </Panel>
          </div>

          {/* CF Tunnels */}
          <Panel label="CF Tunnels \u00b7 LXC 500">
            {cfTunnels === null ? (
              <span className="text-[11px] font-mono text-zinc-500">Loading\u2026</span>
            ) : cfTunnels.length === 0 || cfTunnels[0]?.error ? (
              <span className="text-[11px] font-mono text-zinc-500">{cfTunnels[0]?.error || 'No tunnels found'}</span>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(cfTunnels.length, 3)}, 1fr)` }}>
                {cfTunnels.map((t) => (
                  <div
                    key={t.name}
                    className={`px-4 py-3 bg-black border-[2px] flex items-center gap-2 ${
                      t.running ? 'border-emerald-900/50' : 'border-zinc-800'
                    }`}
                  >
                    <span
                      className="w-[7px] h-[7px] rounded-full shrink-0 inline-block"
                      style={{
                        background: t.running ? '#22c55e' : '#3f3f46',
                        boxShadow: t.running ? '0 0 5px #22c55e' : 'none',
                      }}
                    />
                    <span className="text-[13px] font-bold text-zinc-200 flex-1 truncate">{t.name}</span>
                    <span className={`text-[9px] font-mono tracking-wider shrink-0 ${t.running ? 'text-emerald-500' : 'text-zinc-500'}`}>
                      {t.running ? 'running' : t.sub || 'stopped'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* Recent activity */}
      {recent.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[9px] font-mono font-black uppercase tracking-[0.15em] text-zinc-500 shrink-0">Recent Activity</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>
          <div className="border-[2px] border-zinc-700 bg-zinc-900 shadow-[4px_4px_0_#000]">
            {recent.map((j, i) => {
              const savedBytes = j.size_before && j.size_after ? j.size_before - j.size_after : null;
              const actionLabel = ACTION_LABELS[j.action] || j.action;
              const statusClass = STATUS_COLOR[j.status] || 'text-zinc-500';
              const isLast = i === recent.length - 1;

              return (
                <div
                  key={j.id}
                  className={`grid items-center px-4 py-2.5 hover:bg-zinc-800/50 transition-colors ${!isLast ? 'border-b border-zinc-800' : ''}`}
                  style={{ gridTemplateColumns: '80px 1fr 90px 90px 100px' }}
                >
                  <span className={`text-[11px] font-mono ${statusClass}`}>{j.status}</span>
                  <span className="text-[13px] text-zinc-200 truncate pr-4" title={j.filename}>
                    {j.filename}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">{actionLabel}</span>
                  <span className={`text-[11px] font-mono text-right ${savedBytes && savedBytes > 0 ? 'text-emerald-500' : 'text-zinc-500'}`}>
                    {savedBytes !== null && savedBytes > 0 ? `-${fmtBytes(savedBytes)}` : '\u2014'}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500 text-right">
                    {j.finished_at ? new Date(j.finished_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '\u2014'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
