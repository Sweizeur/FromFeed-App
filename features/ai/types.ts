import type { PlaceSummary } from '@/features/places/types';

export interface PlanActivity {
  id: string;
  planId: string;
  placeId: string;
  order: number;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
  place: PlaceSummary;
  createdAt: string;
}

export interface Plan {
  id: string;
  userId: string;
  date: string;
  title?: string | null;
  notes?: string | null;
  activities: PlanActivity[];
  createdAt: string;
  updatedAt: string;
}

export interface PlansResponse {
  plans: Plan[];
}

export interface PlanResponse {
  plan: Plan;
}

export interface CreatePlanRequest {
  date: string;
  title?: string;
  notes?: string;
  activities: {
    placeId: string;
    order: number;
    startTime?: string;
    notes?: string;
  }[];
}

export interface UpdatePlanRequest {
  title?: string;
  notes?: string;
  activities?: {
    placeId: string;
    order: number;
    startTime?: string;
    notes?: string;
  }[];
}
