import { apiRequest } from './client';
import type { Plan, CreatePlanRequest, UpdatePlanRequest } from '@/types/api';

export async function getPlans(): Promise<{ plans: Plan[] } | null> {
  return apiRequest('/api/plans');
}

export async function getPlan(planId: string): Promise<{ plan: Plan } | null> {
  return apiRequest(`/api/plans/${planId}`);
}

export async function createPlan(data: CreatePlanRequest): Promise<{ plan: Plan } | null> {
  return apiRequest('/api/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePlan(planId: string, data: UpdatePlanRequest): Promise<{ plan: Plan } | null> {
  return apiRequest(`/api/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deletePlan(planId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/plans/${planId}`, { method: 'DELETE' });
}
