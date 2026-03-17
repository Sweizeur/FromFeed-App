import { apiRequest } from './client';
import type {
  LinkPreviewResponse,
  CreateLinkPreviewTaskResponse,
  GetTaskStatusResponse,
} from '@/types/api';

export async function analyzeLink(url: string): Promise<LinkPreviewResponse | null> {
  return apiRequest<LinkPreviewResponse>('/api/link-preview', {
    method: 'POST',
    body: JSON.stringify({ url }),
    timeoutMs: 60000,
  });
}

export async function createLinkPreviewTask(url: string): Promise<CreateLinkPreviewTaskResponse | null> {
  return apiRequest<CreateLinkPreviewTaskResponse>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ url }),
    timeoutMs: 10000,
  });
}

export async function getTaskStatus(taskId: string): Promise<GetTaskStatusResponse | null> {
  return apiRequest<GetTaskStatusResponse>(`/api/tasks/${taskId}`);
}
