export type ApiPatient = {
  id: string;
  name: string;
  age: string;
  photoUrl: string;
  photoBackground: string;
  createdAt: string;
  updatedAt: string;
  lastVisitAt: string | null;
  totalStickers: number;
  visitCount: number;
  pendingFollowUps: number;
};

export type FollowUpRecord = {
  id: string;
  visitId: string;
  sequence: number;
  type: 'energy_check' | 'recovery_challenge' | 'final_review';
  dueAt: string;
  status: 'pending' | 'completed';
  energyLevel: number | null;
  mood: string | null;
  note: string | null;
  reward: string;
  completedAt: string | null;
};

export type VisitRecord = {
  id: string;
  journeyToken: string;
  symptoms: string[];
  overallScore: number;
  diagnosisCode: string;
  startedAt: string;
  completedAt: string;
  results: Array<{ id: string; name: string; summary: string; detail: string; score: number; sticker: string }>;
};

export type RewardRecord = { id: string; code: string; name: string; earnedAt: string };
export type HistoryResponse = { visits: VisitRecord[]; followUps: FollowUpRecord[]; rewards: RewardRecord[]; patient?: ApiPatient };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || '积木医院服务器暂时没有回应');
  return body as T;
}

export const clinicApi = {
  health: () => request<{ ok: boolean }>('/api/health'),
  bootstrap: () => request<{ patients: ApiPatient[]; time: string }>('/api/bootstrap'),
  createPatient: (body: { name: string; age: string; photoDataUrl?: string; photoBackground?: string }) => request<ApiPatient>('/api/patients', { method: 'POST', body: JSON.stringify(body) }),
  updatePatient: (id: string, body: { name: string; age: string; photoDataUrl?: string; photoBackground?: string }) => request<ApiPatient>(`/api/patients/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deletePatient: (id: string) => request<{ ok: boolean }>(`/api/patients/${id}`, { method: 'DELETE' }),
  getJourney: <T>(patientId: string) => request<{ journey: T | null }>(`/api/patients/${patientId}/journey`),
  saveJourney: <T>(patientId: string, journey: T) => request<{ ok: boolean }>(`/api/patients/${patientId}/journey`, { method: 'PUT', body: JSON.stringify({ journey }) }),
  migrate: <T>(journey: T | null) => request<{ migrated: boolean; patients: ApiPatient[]; selectedPatientId?: string }>('/api/migrate', { method: 'POST', body: JSON.stringify({ journey }) }),
  getHistory: (patientId: string) => request<HistoryResponse>(`/api/patients/${patientId}/history`),
  archiveVisit: (body: unknown) => request<HistoryResponse & { archived: boolean; visitId: string; patient: ApiPatient }>('/api/visits', { method: 'POST', body: JSON.stringify(body) }),
  completeFollowUp: (id: string, body: { energyLevel: number; mood: string; note?: string }) => request<HistoryResponse & { patient: ApiPatient }>(`/api/follow-ups/${id}/complete`, { method: 'POST', body: JSON.stringify(body) }),
};
