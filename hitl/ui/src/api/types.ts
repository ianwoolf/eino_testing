// API Types matching the Go server responses

export interface ExecuteRequest {
  name: string;
  location: string;
}

export interface ConfirmRequest {
  execution_id: string;
  action: 'confirm' | 'reject';
  new_args?: string;
}

export interface ToolCallResponse {
  id: string;
  name: string;
  args: string;
}

export interface MessageResponse {
  role: string;
  content: string;
  tool_calls?: ToolCallResponse[];
}

export interface StateResponse {
  execution_id: string;
  status: 'running' | 'interrupted' | 'completed' | 'error';
  message_history: MessageResponse[];
  context: Record<string, unknown>;
  node_execution_log: Record<string, unknown>;
  saved_at: number;
  current_node: string;
  pending_tool_calls?: ToolCallResponse[];
  result?: string;
  error?: string;
}

export interface CheckpointSummary {
  id: string;
  created_at: string;
  size: number;
}

export interface ExecutionInfo {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  checkpoint_id: string;
  input: Record<string, unknown>;
}

export interface WebSocketEvent {
  type: 'state_update' | 'execution_started' | 'execution_completed' | 'error';
  data: ExecutionInfo | StateResponse | { error: string };
  timestamp: number;
}

export interface APIError {
  error: string;
  code?: string;
  details?: string;
}
