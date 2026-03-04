// AUTO-GENERATED FILE - DO NOT EDIT
/* eslint-disable */

export type StatusEnum = 'running' | 'stopped' | 'paused' | 'restarting' | 'unknown';

export interface ServiceResponse {
  id: string;
  name: string;
  container_name: string;
  type: string;
  port: number;
  proxy_path: string;
  status: StatusEnum;
  target_url: string;
  health_status?: string | null;
  uptime_seconds?: number | null;
  cpu_usage?: number | null;
  memory_usage?: number | null;
}

export interface ServiceList {
  services: ServiceResponse[];
  total: number;
  page?: number;
  page_size?: number;
}

export interface UserInfo {
  id: string;
  username: string;
  email: string | null;
  is_admin: boolean;
  created_at?: string | null;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserInfo;
}
