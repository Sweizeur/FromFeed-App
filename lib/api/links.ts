import { apiRequest } from './client';
import type {
  CreateLinkPreviewTaskResponse,
  GetTaskStatusResponse,
} from '@/features/places/types';

export async function createLinkPreviewTask(url: string): Promise<CreateLinkPreviewTaskResponse | null> {
  return apiRequest<CreateLinkPreviewTaskResponse>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ url }),
    timeoutMs: 10000,
  });
}

export async function getTaskStatus(taskId: string): Promise<GetTaskStatusResponse | null> {
  return apiRequest<GetTaskStatusResponse>(`/api/tasks/${encodeURIComponent(taskId)}`);
}
