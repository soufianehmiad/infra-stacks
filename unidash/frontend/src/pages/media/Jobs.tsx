import { useEffect, useState } from 'react';
import { mediaApi, fmtBytes } from '../../lib/media-api';
import JobProgress from '../../components/media/JobProgress';
import type { Job } from '../../types/media';

const STATUS_ORDER: Record<string, number> = { running: 0, pending: 1, done: 2, reverted: 3, failed: 4, cancelled: 5 };
const ACTION_LABELS: Record<string, string> = { reencode: 'Re-encode', remux: 'Remux', downscale: 'Downscale', delete: 'Delete' };
const STATUS_COLOR: Record<string, string> = {
  done: 'text-emerald-500',
  reverted: 'text-amber-500',
  failed: 'text-red-500',
  cancelled: 'text-zinc-500',
};

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[10px] font-mono font-black uppercase tracking-[0.15em] text-zinc-500">{children}</span>
      {count != null && count > 0 && (
        <span className="text-[10px] font-mono font-bold text-brutalist-accent bg-brutalist-accent/10 px-2 py-px border border-brutalist-accent/30">
          {count}
        </span>
      )}
      <div className="flex-1 h-px bg-zinc-800" />
    </div>
  );
}

function JobCard({ job, onCancel }: { job: Job; onCancel: () => void }) {
  const actionLabel = ACTION_LABELS[job.action] || job.action;
  const isActive = ['pending', 'running'].includes(job.status);
  const isRunning = job.status === 'running';

  return (
    <div
      className={`bg-zinc-900 border-[2px] border-zinc-700 mb-2 shadow-[3px_3px_0_#000] ${
        isRunning ? 'border-l-brutalist-accent' : ''
      }`}
      style={{ borderLeftWidth: isRunning ? '3px' : undefined }}
    >
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1.5">
            {isRunning && <div className="w-1.5 h-1.5 rounded-full bg-brutalist-accent animate-pulse shrink-0" />}
            <span className={`text-[11px] font-mono ${isRunning ? 'text-brutalist-accent' : 'text-zinc-400'}`}>{actionLabel}</span>
            {job.status === 'pending' && <span className="text-[11px] font-mono text-zinc-600">\u00b7 queued</span>}
          </div>
          <p className="text-[13px] text-zinc-200 truncate" title={job.filename}>
            {job.filename}
          </p>
          {job.size_before > 0 && <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{fmtBytes(job.size_before)}</p>}
        </div>
        {isActive && (
          <button
            onClick={onCancel}
            className="shrink-0 px-3 py-1 text-[11px] font-bold text-zinc-500 border-[2px] border-zinc-700 bg-transparent hover:text-red-400 hover:border-red-400/50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="px-4 pb-4">
        <JobProgress job={job} />
      </div>
    </div>
  );
}

function HistoryRow({ job }: { job: Job }) {
  const saved = job.size_before && job.size_after ? job.size_before - job.size_after : null;
  const finished = job.finished_at ? new Date(job.finished_at).toLocaleString() : '\u2014';
  const actionLabel = ACTION_LABELS[job.action] || job.action;
  const statusClass = STATUS_COLOR[job.status] || 'text-zinc-500';

  return (
    <tr className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
      <td className="py-2.5 px-4 max-w-[260px]">
        <p className="text-[13px] text-zinc-200 truncate" title={job.filename}>
          {job.filename}
        </p>
        {job.error && (
          <p className="text-[10px] font-mono text-red-400 truncate mt-0.5" title={job.error}>
            {job.error}
          </p>
        )}
      </td>
      <td className="py-2.5 px-4">
        <span className="text-[11px] font-mono text-zinc-400">{actionLabel}</span>
      </td>
      <td className="py-2.5 px-4">
        <span className={`text-[11px] font-mono ${statusClass}`}>{job.status}</span>
      </td>
      <td className="py-2.5 px-4 text-right">
        {saved !== null && saved > 0 ? (
          <span className="text-[11px] font-mono text-emerald-500">-{fmtBytes(saved)}</span>
        ) : saved !== null && saved <= 0 ? (
          <span className="text-[11px] font-mono text-zinc-500">+{fmtBytes(Math.abs(saved))}</span>
        ) : (
          <span className="text-zinc-600">\u2014</span>
        )}
      </td>
      <td className="py-2.5 px-4">
        <span className="text-[11px] font-mono text-zinc-500">{finished}</span>
      </td>
    </tr>
  );
}

export default function MediaJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await mediaApi.jobs();
      setJobs(data.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function handleCancel(id: number) {
    setCancelError(null);
    try {
      await mediaApi.cancelJob(id);
      load();
    } catch (e: any) {
      setCancelError(e.message);
    }
  }

  const running = jobs.filter((j) => j.status === 'running');
  const pending = jobs.filter((j) => j.status === 'pending');
  const history = jobs.filter((j) => !['running', 'pending'].includes(j.status));

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

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-black uppercase tracking-tight text-zinc-100 leading-none">Jobs</h1>
        <p className="text-[11px] font-mono text-zinc-500 mt-1">Encode queue & history</p>
      </div>

      {cancelError && (
        <div className="px-3 py-2 text-[11px] font-mono text-red-400 bg-red-500/10 border border-red-500/30">{cancelError}</div>
      )}

      {/* Running */}
      {running.length > 0 && (
        <section>
          <SectionTitle count={running.length}>Running</SectionTitle>
          {running.map((j) => (
            <JobCard key={j.id} job={j} onCancel={() => handleCancel(j.id)} />
          ))}
        </section>
      )}

      {/* Queue */}
      <section>
        <SectionTitle count={pending.length}>Queue</SectionTitle>
        {pending.length === 0 ? (
          <p className="text-[11px] font-mono text-zinc-500 py-4">Queue empty</p>
        ) : (
          pending.map((j) => <JobCard key={j.id} job={j} onCancel={() => handleCancel(j.id)} />)
        )}
      </section>

      {/* History */}
      {history.length > 0 && (
        <section>
          <SectionTitle>History</SectionTitle>
          <div className="border-[2px] border-zinc-700 shadow-[4px_4px_0_#000]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-zinc-800/50 border-b-[2px] border-zinc-700">
                  {['File', 'Action', 'Result', 'Saved', 'Finished'].map((h) => (
                    <th
                      key={h}
                      className="py-2.5 px-4 text-[10px] font-mono font-black uppercase tracking-[0.15em] text-zinc-500"
                      style={{ textAlign: h === 'Saved' ? 'right' : 'left' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((j) => (
                  <HistoryRow key={j.id} job={j} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Empty */}
      {jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-[16px] font-bold text-zinc-400">No jobs yet</p>
          <p className="text-[11px] font-mono text-zinc-500">Go to Library to queue encode or delete jobs</p>
        </div>
      )}
    </div>
  );
}
