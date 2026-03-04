import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/auth-store';
import { z } from 'zod';

class APIClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: '',
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      const token = useAuthStore.getState().accessToken;
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          const originalRequest = error.config;
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            try {
              if (!this.refreshPromise) {
                this.refreshPromise = this.refreshToken();
              }
              const newToken = await this.refreshPromise;
              this.refreshPromise = null;
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.client(originalRequest);
            } catch (refreshError) {
              useAuthStore.getState().logout();
              return Promise.reject(refreshError);
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private async refreshToken(): Promise<string> {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) throw new Error('No refresh token');

    const response = await axios.post('/api/auth/refresh', { refresh_token: refreshToken });
    const { access_token, refresh_token: newRefreshToken } = response.data;
    useAuthStore.getState().setTokens(access_token, newRefreshToken);
    return access_token;
  }

  async get<T>(url: string, schema: z.ZodType<T>): Promise<T> {
    const response = await this.client.get(url);
    return schema.parse(response.data);
  }

  async post(url: string, data: any): Promise<any> {
    const response = await this.client.post(url, data);
    return response.data;
  }
}

export const apiClient = new APIClient();
