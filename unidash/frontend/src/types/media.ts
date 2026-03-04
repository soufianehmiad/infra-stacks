// MediaMgr type definitions

export interface MediaFile {
  id: number;
  filename: string;
  path: string;
  folder: string;
  size_bytes: number;
  codec: string;
  resolution: string;
  height: number;
  duration_s: number;
  audio_codec: string;
  suggested_action: string;
}

export interface FilesResponse {
  items: MediaFile[];
  total: number;
  limit: number;
  offset: number;
}

export interface FileQueryParams {
  folder?: string;
  codec?: string;
  resolution?: string;
  audio?: string;
  search?: string;
  suggested_action?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_dir?: string;
}

export interface Job {
  id: number;
  file_id: number;
  filename: string;
  action: string;
  status: string;
  progress: number;
  eta_s: number | null;
  size_before: number;
  size_after: number | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface StorageFolder {
  folder: string;
  used_bytes: number;
  total_bytes: number;
  free_bytes: number;
}

export interface StorageStats {
  files_count: number;
  jobs_count: number;
  pending_jobs: number;
  saved_bytes: number;
}

export interface StorageResponse {
  folders: StorageFolder[];
  stats: StorageStats;
}

export interface StorageHistoryEntry {
  date: string;
  saved_bytes: number;
  total_bytes: number;
}

export interface CfTunnel {
  name: string;
  running: boolean;
  description?: string;
  service?: string;
  sub?: string;
  error?: string;
}

export interface IngressRule {
  _id: number;
  hostname: string;
  path: string;
  service: string;
}

export interface CfConfig {
  ingress: Array<{
    hostname?: string;
    path?: string;
    service: string;
  }>;
}

export interface JobWsMessage {
  pct?: number;
  eta_s?: number;
  status?: string;
  ping?: boolean;
}
