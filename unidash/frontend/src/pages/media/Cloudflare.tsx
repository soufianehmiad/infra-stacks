import { useCallback, useEffect, useRef, useState } from 'react';
import { mediaCf, connectCfLogsWs } from '../../lib/media-api';
import type { CfTunnel, IngressRule } from '../../types/media';

// ─── Primitives ──────────────────────────────────────────────────────────────

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className="inline-block w-[7px] h-[7px] rounded-full shrink-0 transition-colors"
      style={{
        background: on ? '#22c55e' : '#3f3f46',
        boxShadow: on ? '0 0 6px #22c55e' : 'none',
      }}
    />
  );
}

function Btn({
  label,
  onClick,
  disabled,
  variant = 'ghost',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'ghost' | 'accent' | 'danger' | 'success' | 'warn';
}) {
  const styles: Record<string, string> = {
    ghost: 'text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:border-zinc-500',
    accent: 'text-brutalist-accent border-brutalist-accent/50 bg-brutalist-accent/10 hover:bg-brutalist-accent/20',
    danger: 'text-red-400 border-red-500/50 bg-red-500/10 hover:bg-red-500/20',
    success: 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20',
    warn: 'text-amber-400 border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20',
  };
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-1 text-[11px] font-bold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      {label}
    </button>
  );
}

// ─── Log viewer ──────────────────────────────────────────────────────────────

function LogLine({ line }: { line: string }) {
  if (/\bERR\b|error/i.test(line)) return <div className="text-red-400 whitespace-pre-wrap break-all">{line}</div>;
  if (/\bWARN\b|warning/i.test(line)) return <div className="text-amber-400 whitespace-pre-wrap break-all">{line}</div>;
  if (/\bINF\b|info/i.test(line)) return <div className="text-emerald-400/80 whitespace-pre-wrap break-all">{line}</div>;
  return <div className="whitespace-pre-wrap break-all">{line}</div>;
}

function LogViewer({ tunnelName }: { tunnelName: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const MAX = 600;

  useEffect(() => {
    setLines([]);
    setError(null);
    mediaCf
      .logs(tunnelName, 200)
      .then((ls) => setLines(ls))
      .catch((e) => setError(e.message));
  }, [tunnelName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  function startLive() {
    if (wsRef.current) return;
    const ws = connectCfLogsWs(
      tunnelName,
      (line) =>
        setLines((p) => {
          const n = [...p, line];
          return n.length > MAX ? n.slice(-MAX) : n;
        }),
      () => {
        setLive(false);
        wsRef.current = null;
        setError('Stream disconnected');
      },
    );
    ws.onopen = () => setLive(true);
    ws.onclose = () => {
      setLive(false);
      wsRef.current = null;
    };
    wsRef.current = ws;
  }

  function stopLive() {
    wsRef.current?.close();
    wsRef.current = null;
    setLive(false);
  }

  useEffect(() => () => wsRef.current?.close(), []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono font-bold tracking-wider uppercase text-zinc-500">{lines.length} lines</span>
        {live && <span className="text-[9px] font-mono font-bold text-emerald-400">\u25cf LIVE</span>}
        <div className="flex-1" />
        {live ? <Btn label="Stop" onClick={stopLive} /> : <Btn label="Live tail" onClick={startLive} variant="accent" />}
      </div>
      {error && <span className="text-[10px] font-mono text-red-400">{error}</span>}
      <div className="bg-black border-[2px] border-zinc-700 p-3 h-[340px] overflow-y-auto font-mono text-[11px] leading-relaxed text-zinc-400 shadow-[4px_4px_0_#000]">
        {lines.length === 0 ? <span className="opacity-40">No logs yet.</span> : lines.map((l, i) => <LogLine key={i} line={l} />)}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Ingress editor ──────────────────────────────────────────────────────────

function IngressEditor({ tunnelName, onSaved }: { tunnelName: string; onSaved?: () => void }) {
  const [rules, setRules] = useState<IngressRule[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setRules(null);
    setMsg(null);
    mediaCf
      .config(tunnelName)
      .then((cfg) => {
        setRules(
          (cfg?.ingress || []).map((r, i) => ({
            _id: i,
            hostname: r.hostname || '',
            path: r.path || '',
            service: r.service || '',
          })),
        );
      })
      .catch((e) => setMsg({ ok: false, text: e.message }));
  }, [tunnelName]);

  function set(id: number, field: keyof IngressRule, val: string) {
    setRules((p) => (p ? p.map((r) => (r._id === id ? { ...r, [field]: val } : r)) : p));
  }

  function remove(id: number) {
    setRules((p) => (p ? p.filter((r) => r._id !== id) : p));
  }

  function add() {
    setRules((p) => (p ? [...p, { _id: Date.now(), hostname: '', path: '', service: '' }] : p));
  }

  async function save(andRestart: boolean) {
    if (!rules) return;
    setSaving(true);
    setMsg(null);
    try {
      const clean = rules.map(({ hostname, path, service }) => {
        const r: { service: string; hostname?: string; path?: string } = { service: service.trim() };
        if (hostname.trim()) r.hostname = hostname.trim();
        if (path.trim()) r.path = path.trim();
        return r;
      });
      await mediaCf.updateIngress(tunnelName, clean);
      if (andRestart) {
        await mediaCf.control(tunnelName, 'restart');
        setMsg({ ok: true, text: 'Saved & tunnel restarted' });
      } else {
        setMsg({ ok: true, text: 'Saved \u2014 restart tunnel to apply' });
      }
      onSaved?.();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  }

  if (!rules && !msg) return <span className="text-[10px] font-mono text-zinc-500">Loading config\u2026</span>;
  if (msg && !rules) return <span className="text-[10px] font-mono text-red-400">{msg.text}</span>;
  if (!rules) return null;

  const hasCatchAll = rules.some((r) => !r.hostname.trim());

  const inputClass = 'bg-black border-[2px] border-zinc-700 text-zinc-200 px-2.5 py-1.5 text-[12px] font-mono outline-none w-full focus:border-brutalist-accent/50 transition-colors';

  return (
    <div className="flex flex-col gap-3">
      {/* Headers */}
      <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 0.6fr 1fr 28px' }}>
        <span className="text-[9px] font-mono font-black uppercase tracking-[0.15em] text-zinc-500">Hostname</span>
        <span className="text-[9px] font-mono font-black uppercase tracking-[0.15em] text-zinc-500">Path</span>
        <span className="text-[9px] font-mono font-black uppercase tracking-[0.15em] text-zinc-500">Service</span>
        <span />
      </div>

      {/* Rules */}
      {rules.map((r) => (
        <div key={r._id} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 0.6fr 1fr 28px' }}>
          <input className={inputClass} value={r.hostname} placeholder="any (catch-all)" onChange={(e) => set(r._id, 'hostname', e.target.value)} />
          <input className={inputClass} value={r.path} placeholder=".*" onChange={(e) => set(r._id, 'path', e.target.value)} />
          <input className={inputClass} value={r.service} placeholder="http://localhost:8080" onChange={(e) => set(r._id, 'service', e.target.value)} />
          <button
            onClick={() => remove(r._id)}
            className="w-7 h-7 bg-transparent border-[2px] border-zinc-700 text-red-400 flex items-center justify-center text-[14px] hover:border-red-400 transition-colors"
          >
            \u00d7
          </button>
        </div>
      ))}

      {!hasCatchAll && rules.length > 0 && (
        <span className="text-[10px] font-mono text-amber-400">
          \u26a0 Last rule should be a catch-all (no hostname) e.g. service: http_status:404
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
        <Btn label="+ Add rule" onClick={add} />
        <div className="flex-1" />
        <Btn label={saving ? 'Saving\u2026' : 'Save'} onClick={() => save(false)} disabled={saving} variant="accent" />
        <Btn label={saving ? '\u2026' : 'Save & Restart'} onClick={() => save(true)} disabled={saving} variant="warn" />
      </div>

      {msg && <span className={`text-[10px] font-mono ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
    </div>
  );
}

// ─── Tunnel detail ───────────────────────────────────────────────────────────

function TunnelDetail({
  tunnelName,
  tunnel,
  onControl,
  busy,
  onRefresh,
}: {
  tunnelName: string;
  tunnel?: CfTunnel;
  onControl: (name: string, action: string) => void;
  busy: boolean;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState('ingress');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b-[2px] border-zinc-700 flex items-center gap-2 flex-wrap bg-zinc-800/30">
        <Dot on={!!tunnel?.running} />
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-black text-zinc-100">{tunnelName}</div>
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500">{tunnel?.description || tunnel?.service || ''}</span>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {tunnel?.running ? (
            <>
              <Btn label="Restart" onClick={() => onControl(tunnelName, 'restart')} disabled={busy} variant="accent" />
              <Btn label="Stop" onClick={() => onControl(tunnelName, 'stop')} disabled={busy} variant="danger" />
            </>
          ) : (
            <Btn label="Start" onClick={() => onControl(tunnelName, 'start')} disabled={busy} variant="success" />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b-[2px] border-zinc-700 px-5 bg-zinc-800/30">
        {['logs', 'ingress'].map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-[10px] font-mono font-black uppercase tracking-wider transition-colors border-b-2 ${
              tab === id ? 'text-brutalist-accent border-b-brutalist-accent' : 'text-zinc-500 border-b-transparent hover:text-zinc-300'
            }`}
          >
            {id}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'logs' && <LogViewer key={tunnelName} tunnelName={tunnelName} />}
        {tab === 'ingress' && <IngressEditor key={tunnelName} tunnelName={tunnelName} onSaved={onRefresh} />}
      </div>
    </div>
  );
}

// ─── Tunnel list item ────────────────────────────────────────────────────────

function TunnelItem({ tunnel, selected, onClick }: { tunnel: CfTunnel; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`px-4 py-3 cursor-pointer border-b border-zinc-800 transition-colors ${
        selected ? 'bg-zinc-800/50 border-l-[3px] border-l-brutalist-accent pl-[13px]' : 'border-l-[3px] border-l-transparent hover:bg-zinc-800/30'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Dot on={tunnel.running} />
        <span className={`text-[14px] font-bold truncate ${selected ? 'text-zinc-100' : 'text-zinc-400'}`}>{tunnel.name}</span>
      </div>
      <span
        className={`text-[9px] font-mono font-bold uppercase tracking-wider pl-4 block ${tunnel.running ? 'text-emerald-500/80' : 'text-zinc-600'}`}
      >
        {tunnel.running ? 'running' : tunnel.sub || 'stopped'}
      </span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MediaCloudflare() {
  const [tunnels, setTunnels] = useState<CfTunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await mediaCf.tunnels();
      setFetchErr(null);
      setTunnels(data);
      setSelected((prev) => prev ?? (data[0]?.name || null));
    } catch (e: any) {
      setFetchErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function handleControl(name: string, action: string) {
    setBusy(true);
    try {
      await mediaCf.control(name, action);
      showToast(`${name}: ${action} OK`, true);
      await load();
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setBusy(false);
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

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

  const runCount = tunnels.filter((t) => t.running).length;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-[28px] font-black uppercase tracking-tight text-zinc-100 leading-none">Cloudflare Tunnels</h1>
          <p className="text-[11px] font-mono text-zinc-500 mt-1">
            {fetchErr ? 'connection error \u00b7 LXC 500' : `${runCount}/${tunnels.length} running \u00b7 LXC 500`}
          </p>
        </div>
        {toast && (
          <div
            className={`px-3 py-2 text-[11px] font-mono border ${
              toast.ok ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'
            }`}
          >
            {toast.msg}
          </div>
        )}
      </div>

      {fetchErr && (
        <div className="bg-red-500/10 border-[2px] border-red-500/50 px-3 py-2 mb-3 shrink-0 font-mono text-[11px] text-red-400">
          Cannot reach LXC 500: {fetchErr}
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex border-[2px] border-zinc-700 flex-1 min-h-0 shadow-[4px_4px_0_#000]">
        {/* Left: tunnel list */}
        <div className="w-[260px] shrink-0 border-r-[2px] border-zinc-700 overflow-y-auto bg-zinc-900/50">
          {tunnels.length === 0 ? (
            <span className="text-[10px] font-mono text-zinc-500 p-4 block">No tunnels</span>
          ) : (
            tunnels.map((t) => (
              <TunnelItem key={t.name} tunnel={t} selected={selected === t.name} onClick={() => setSelected(t.name)} />
            ))
          )}
        </div>

        {/* Right: detail */}
        <div className="flex-1 min-w-0 flex flex-col">
          {selected ? (
            <TunnelDetail
              key={selected}
              tunnelName={selected}
              tunnel={tunnels.find((t) => t.name === selected)}
              onControl={handleControl}
              busy={busy}
              onRefresh={load}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[10px] font-mono text-zinc-500">Select a tunnel</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
