// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from Pydantic models at 2026-01-26T23:34:03.870344Z
// Generator: backend/scripts/generate_types.py

/* eslint-disable */

import { z } from 'zod';

/**
 * Standard API response wrapper
 */
export const BaseResponseSchema = z.object({
  success: z.boolean().default(true).optional(),
  message: z.any().optional(),
});

export type BaseResponse = z.infer<typeof BaseResponseSchema>;

/**
 * Base model with automatic timestamps
 */
export const TimestampedModelSchema = z.object({
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type TimestampedModel = z.infer<typeof TimestampedModelSchema>;

/**
 * Service action request
 */
export const ServiceActionRequestSchema = z.object({
  action: z.enum(["start", "stop", "restart"]),
});

export type ServiceActionRequest = z.infer<typeof ServiceActionRequestSchema>;

/**
 * Service action response
 */
export const ServiceActionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  service_id: z.string(),
  new_status: z.enum(["running", "stopped", "paused", "restarting", "unknown"]),
});

export type ServiceActionResponse = z.infer<typeof ServiceActionResponseSchema>;

/**
 * Base service information
 */
export const ServiceBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  container_name: z.string(),
  type: z.string(),
  internal_port: z.number().int(),
  proxy_path: z.any().optional(),
  icon: z.any().optional(),
  status: z.enum(["running", "stopped", "paused", "restarting", "unknown"]).optional(),
});

export type ServiceBase = z.infer<typeof ServiceBaseSchema>;

/**
 * Service with computed fields and metrics
 */
export const ServiceResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  container_name: z.string(),
  type: z.string(),
  internal_port: z.number().int(),
  proxy_path: z.any().optional(),
  icon: z.any().optional(),
  status: z.enum(["running", "stopped", "paused", "restarting", "unknown"]).optional(),
  target_url: z.string(),
  health_status: z.union([z.enum(["healthy", "degraded", "unhealthy"]), z.any()]).optional(),
  uptime_seconds: z.any().optional(),
  cpu_usage: z.any().optional(),
  memory_usage: z.any().optional(),
});

export type ServiceResponse = z.infer<typeof ServiceResponseSchema>;

/**
 * Paginated service list response
 */
export const ServiceListSchema = z.object({
  services: z.array(ServiceResponseSchema),
  total: z.number().int(),
  page: z.number().int().default(1).optional(),
  page_size: z.number().int().default(100).optional(),
});

export type ServiceList = z.infer<typeof ServiceListSchema>;

/**
 * Password change request
 */
export const ChangePasswordRequestSchema = z.object({
  current_password: z.string(),
  new_password: z.string(),
});

export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

/**
 * User login credentials
 */
export const LoginRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * Login success response with tokens
 */
export const LoginResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string().default("bearer").optional(),
  expires_in: z.number().int().default(900).optional(),
  user: z.any(),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/**
 * Token refresh request
 */
export const RefreshRequestSchema = z.object({
  refresh_token: z.string(),
});

export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

/**
 * Token refresh response
 */
export const RefreshResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().int().default(900).optional(),
});

export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

/**
 * JWT token payload structure
 */
export const TokenPayloadSchema = z.object({
  sub: z.string(),
  exp: z.string().datetime(),
  iat: z.string().datetime().optional(),
  type: z.enum(["access", "refresh"]).optional(),
});

export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

/**
 * User information (non-sensitive)
 */
export const UserInfoSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.any().optional(),
  is_admin: z.boolean().default(false).optional(),
  created_at: z.string().datetime().nullable().optional(),
});

export type UserInfo = z.infer<typeof UserInfoSchema>;

/**
 * Error message
 */
export const ErrorMessageSchema = z.object({
  type: z.enum(["error"]).optional(),
  timestamp: z.string().datetime().optional(),
  data: z.record(z.string(), z.any()).optional(),
  error: z.string(),
  code: z.any().optional(),
});

export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

/**
 * System metrics update
 */
export const MetricsMessageSchema = z.object({
  type: z.enum(["metrics"]).optional(),
  timestamp: z.string().datetime().optional(),
  data: z.record(z.string(), z.any()).optional(),
  cpu_usage: z.number(),
  memory_usage: z.number(),
  memory_total: z.number(),
  network_rx: z.number(),
  network_tx: z.number(),
  disk_usage: z.number(),
});

export type MetricsMessage = z.infer<typeof MetricsMessageSchema>;

/**
 * User notification message
 */
export const NotificationMessageSchema = z.object({
  type: z.enum(["notification"]).optional(),
  timestamp: z.string().datetime().optional(),
  data: z.record(z.string(), z.any()).optional(),
  level: z.enum(["info", "success", "warning", "error"]),
  title: z.string(),
  message: z.string(),
});

export type NotificationMessage = z.infer<typeof NotificationMessageSchema>;

/**
 * Client ping message for keep-alive
 */
export const PingMessageSchema = z.object({
  type: z.enum(["ping"]).optional(),
  timestamp: z.string().datetime().optional(),
  data: z.record(z.string(), z.any()).optional(),
});

export type PingMessage = z.infer<typeof PingMessageSchema>;

/**
 * Server pong response
 */
export const PongMessageSchema = z.object({
  type: z.enum(["pong"]).optional(),
  timestamp: z.string().datetime().optional(),
  data: z.record(z.string(), z.any()).optional(),
});

export type PongMessage = z.infer<typeof PongMessageSchema>;

/**
 * Service state change notification
 */
export const ServiceUpdateMessageSchema = z.object({
  type: z.enum(["service_update"]).optional(),
  timestamp: z.string().datetime().optional(),
  data: z.record(z.string(), z.any()).optional(),
  service_id: z.string(),
  action: z.enum(["added", "removed", "updated", "status_changed"]),
  new_status: z.any().optional(),
});

export type ServiceUpdateMessage = z.infer<typeof ServiceUpdateMessageSchema>;

/**
 * Base WebSocket message structure
 */
export const WSMessageSchema = z.object({
  type: z.string(),
  timestamp: z.string().datetime().optional(),
  data: z.record(z.string(), z.any()).optional(),
});

export type WSMessage = z.infer<typeof WSMessageSchema>;

/**
 * Individual component health status
 */
export const ComponentHealthSchema = z.object({
  name: z.string(),
  healthy: z.boolean(),
  message: z.any().optional(),
  response_time_ms: z.any().optional(),
});

export type ComponentHealth = z.infer<typeof ComponentHealthSchema>;

/**
 * Detailed health check with component breakdown
 */
export const DetailedHealthCheckSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  version: z.string(),
  environment: z.string(),
  uptime_seconds: z.any().optional(),
  timestamp: z.string().datetime().optional(),
  services_count: z.any().optional(),
  checks: z.record(z.string(), z.boolean()).optional(),
  components: z.array(ComponentHealthSchema).optional(),
});

export type DetailedHealthCheck = z.infer<typeof DetailedHealthCheckSchema>;

/**
 * Application health check response
 */
export const HealthCheckSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  version: z.string(),
  environment: z.string(),
  uptime_seconds: z.any().optional(),
  timestamp: z.string().datetime().optional(),
  services_count: z.any().optional(),
  checks: z.record(z.string(), z.boolean()).optional(),
});

export type HealthCheck = z.infer<typeof HealthCheckSchema>;

