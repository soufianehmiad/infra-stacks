import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { fmtBytes } from '../../lib/media-api';
import type { StorageFolder, StorageHistoryEntry } from '../../types/media';

const FOLDER_COLORS: Record<string, string> = {
  movies: '#d97706',
  series: '#b45309',
  anime: '#92400e',
  downloads: '#78716c',
  free: '#27272a',
};

const FOLDER_LABELS: Record<string, string> = {
  movies: 'Movies',
  series: 'Series',
  anime: 'Anime',
  downloads: 'Downloads',
  free: 'Free',
};

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-zinc-800 border-[2px] border-zinc-600 px-3 py-2 shadow-[3px_3px_0_#000]">
      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
        {FOLDER_LABELS[name] || name}
      </div>
      <div className="text-[12px] font-mono font-bold text-zinc-100">{fmtBytes(value)}</div>
    </div>
  );
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-800 border-[2px] border-zinc-600 px-3 py-2 shadow-[3px_3px_0_#000]">
      <div className="text-[10px] font-mono font-bold text-zinc-400 mb-0.5">{label}</div>
      <div className="text-[12px] font-mono font-bold text-brutalist-accent">{payload[0].value} GB saved</div>
    </div>
  );
}

export function DiskDonut({ folders }: { folders: StorageFolder[] }) {
  if (!folders || folders.length === 0) return null;

  const ref = folders[0];
  const total = ref.total_bytes || 0;
  const totalUsed = folders.reduce((a, f) => a + f.used_bytes, 0);

  const data = [
    ...folders.map((f) => ({ name: f.folder, value: f.used_bytes })),
    { name: 'free', value: Math.max(0, ref.free_bytes) },
  ].filter((d) => d.value > 0);

  const usedPct = total ? Math.round((totalUsed / total) * 100) : 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0 w-[160px] h-[160px]">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie data={data} cx={75} cy={75} innerRadius={50} outerRadius={72} paddingAngle={2} dataKey="value" strokeWidth={0}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={FOLDER_COLORS[entry.name] || '#3f3f46'} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[22px] font-mono font-bold text-brutalist-accent">{usedPct}%</span>
          <span className="text-[10px] font-mono text-zinc-500">used</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-2">
        {folders.map((f) => (
          <div key={f.folder} className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: FOLDER_COLORS[f.folder] || '#3f3f46' }} />
            <span className="text-[11px] text-zinc-400 w-[72px]">{FOLDER_LABELS[f.folder] || f.folder}</span>
            <span className="text-[11px] font-mono font-bold text-zinc-200 ml-auto">{fmtBytes(f.used_bytes)}</span>
          </div>
        ))}
        <div className="flex items-center gap-2.5 pt-1.5 border-t border-zinc-700">
          <div className="w-2 h-2 rounded-full shrink-0 bg-zinc-600" />
          <span className="text-[11px] text-zinc-500 w-[72px]">Free</span>
          <span className="text-[11px] font-mono font-bold text-zinc-500 ml-auto">{fmtBytes(ref.free_bytes)}</span>
        </div>
      </div>
    </div>
  );
}

export function SavingsChart({ history }: { history: StorageHistoryEntry[] }) {
  if (!history || history.length === 0) {
    return (
      <div className="flex items-center justify-center h-[160px]">
        <p className="text-[11px] font-mono text-zinc-500">No history yet</p>
      </div>
    );
  }

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const data = sorted.map((h, i) => {
    const prevSaved = i > 0 ? sorted[i - 1].saved_bytes : 0;
    const delta = Math.max(0, h.saved_bytes - prevSaved);
    return { date: h.date.slice(5), saved: parseFloat((delta / 1e9).toFixed(2)) };
  });

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="#3f3f46" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }} axisLine={{ stroke: '#3f3f46' }} tickLine={false} />
        <YAxis tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} unit=" GB" />
        <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(217,119,6,0.06)' }} />
        <Bar dataKey="saved" fill="#d97706" radius={[2, 2, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
