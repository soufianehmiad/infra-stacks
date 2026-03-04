import { useEffect, useState } from 'react';
import { connectJobWs, fmtDuration } from '../../lib/media-api';
import type { Job } from '../../types/media';

export default function JobProgress({ job }: { job: Job }) {
  const [progress, setProgress] = useState(job.progress || 0);
  const [eta, setEta] = useState(job.eta_s);
  const [status, setStatus] = useState(job.status);

  useEffect(() => {
    setProgress(job.progress || 0);
    setEta(job.eta_s);
    setStatus(job.status);
    if (!['pending', 'running'].includes(job.status)) return;
    const ws = connectJobWs(job.id, (msg) => {
      if (msg.ping) return;
      if (msg.pct !== undefined) setProgress(msg.pct);
      if (msg.eta_s !== undefined) setEta(msg.eta_s);
      if (msg.status) setStatus(msg.status);
    });
    return () => ws.close();
  }, [job.id, job.status]);

  const isRunning = status === 'running';
  const pct = status === 'done' || status === 'reverted' ? 100 : progress;

  const barColor =
    status === 'done'
      ? 'bg-emerald-500'
      : status === 'reverted'
        ? 'bg-amber-500'
        : status === 'failed'
          ? 'bg-red-500'
          : status === 'cancelled'
            ? 'bg-zinc-500'
            : 'bg-brutalist-accent';

  return (
    <div>
      <div className="h-[3px] bg-zinc-800 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${isRunning ? 'media-progress-running' : barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[11px] font-mono text-zinc-500">{isRunning ? `${progress}%` : status}</span>
        {isRunning && eta != null && (
          <span className="text-[11px] font-mono text-zinc-500">ETA {fmtDuration(eta)}</span>
        )}
      </div>
    </div>
  );
}
