import {
  ExecuteRequest,
  ConfirmRequest,
  StateResponse,
  CheckpointSummary,
  ExecutionInfo,
  APIError,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class APIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error: APIError = await response.json().catch(() => ({
        error: 'Unknown error',
      }));
      throw new Error(error.error || error.details || 'Request failed');
    }

    return response.json();
  }

  // Execution endpoints
  async execute(request: ExecuteRequest): Promise<ExecutionInfo> {
    return this.request<ExecutionInfo>('/execute', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async resumeExecution(executionId: string): Promise<ExecutionInfo> {
    return this.request<ExecutionInfo>(`/execute/${executionId}/resume`, {
      method: 'POST',
    });
  }

  async getState(executionId: string): Promise<StateResponse> {
    return this.request<StateResponse>(`/state/${executionId}`);
  }

  async confirm(request: ConfirmRequest): Promise<{ status: string; new_args?: string }> {
    return this.request<{ status: string; new_args?: string }>('/confirm', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async listExecutions(): Promise<ExecutionInfo[]> {
    const result = await this.request<ExecutionInfo[]>('/executions');
    // Ensure we always return an array
    return Array.isArray(result) ? result : [];
  }

  async getExecution(executionId: string): Promise<ExecutionInfo> {
    return this.request<ExecutionInfo>(`/executions/${executionId}`);
  }

  async getLogs(executionId: string): Promise<Array<{ timestamp: string; message: string; level: string }>> {
    return this.request<Array<{ timestamp: string; message: string; level: string }>>(`/logs/${executionId}`);
  }

  // Checkpoint endpoints
  async listCheckpoints(): Promise<CheckpointSummary[]> {
    const result = await this.request<CheckpointSummary[]>('/checkpoints');
    // Ensure we always return an array
    return Array.isArray(result) ? result : [];
  }

  async deleteCheckpoint(checkpointId: string): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/checkpoints/${checkpointId}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; time: number }> {
    return this.request<{ status: string; time: number }>('/health');
  }
}

export const apiClient = new APIClient();
