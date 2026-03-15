import type { UserProfile } from './user-store';
import { supabase } from './supabase';

export const API_BASE = 'https://rehab.mzhang.dev/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
  return res.json();
}

export type CreateUserPayload = {
  supabase_id: string;
  name: string;
  sport: string;
  injury_description: string;
  injury_date: string;
  doctor_diagnosis?: string;
  pt_name?: string;
};

export type ExerciseItem = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  duration?: string;
  cat: 'stretch' | 'strength' | 'mobility';
  accent_color: string;
  is_rehab: boolean;
  scheduled_date: string;
  completed: boolean;
  completed_at?: string;
};

export type DaySection = {
  day_abbr: string;
  day_num: string;
  month: string;
  exercises: ExerciseItem[];
};

export type StatsData = {
  streak_days: number;
  streak_change: number;
  mobility_index: number;
  mobility_change: number;
  pain_reduction: number;
  pain_change: number;
};

export type MetricPoint = {
  week: string;
  pain: number;
  mobility: number;
  strength: number;
};

export type InjuryMarker = {
  id?: string;
  slug: string;
  side?: string | null;
  status: string;
  how_it_happened?: string | null;
  date_of_injury?: string | null;
  doctor_diagnosis?: string | null;
  initial_symptoms?: string | null;
};

export const api = {
  // ── Users ──────────────────────────────────────────────────────────────────
  createUser: (payload: CreateUserPayload) =>
    request<UserProfile>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getUser: (id: string) =>
    request<UserProfile>(`/users/${id}`),

  updateUser: (id: string, payload: Partial<CreateUserPayload>) =>
    request<UserProfile>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // ── Exercises ──────────────────────────────────────────────────────────────
  getTodayExercises: (userId: string) =>
    request<ExerciseItem[]>(`/users/${userId}/exercises/today`),

  toggleExercise: (userId: string, exerciseId: string) =>
    request<{ completed: boolean }>(
      `/users/${userId}/exercises/${exerciseId}/complete`,
      { method: 'PATCH' },
    ),

  getExerciseSchedule: (userId: string) =>
    request<DaySection[]>(`/users/${userId}/exercises/schedule`),

  // ── Checkins ───────────────────────────────────────────────────────────────
  createCheckin: (userId: string, painLevel: number, symptoms: string[]) =>
    request<{ id: string }>(`/users/${userId}/checkins`, {
      method: 'POST',
      body: JSON.stringify({ pain_level: painLevel, symptoms }),
    }),

  // ── Stats & Metrics ────────────────────────────────────────────────────────
  getStats: (userId: string) =>
    request<StatsData>(`/users/${userId}/stats`),

  getMetricsHistory: (userId: string) =>
    request<MetricPoint[]>(`/users/${userId}/metrics/history`),

  // ── Injury markers ─────────────────────────────────────────────────────────
  getInjuryMarkers: (userId: string) =>
    request<InjuryMarker[]>(`/users/${userId}/injury-markers`),

  saveInjuryMarkers: (userId: string, markers: InjuryMarker[]) =>
    request<{ saved: number }>(`/users/${userId}/injury-markers`, {
      method: 'PUT',
      body: JSON.stringify(markers),
    }),
};
