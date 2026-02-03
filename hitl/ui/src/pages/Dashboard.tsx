import { useState, useEffect } from 'react';
import { ExecutionInfo, StateResponse, WebSocketEvent } from '../api/types';
import { apiClient } from '../api/client';
import { WebSocketClient } from '../api/websocket';
import { WorkflowGraph } from '../components/WorkflowGraph';
import { ToolCallConfirm } from '../components/ToolCallConfirm';
import { StateInspector } from '../components/StateInspector';
import { CheckpointList } from '../components/CheckpointList';
import { MessageHistory } from '../components/MessageHistory';

export function Dashboard() {
  const [executions, setExecutions] = useState<ExecutionInfo[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const [state, setState] = useState<StateResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('Megumin');
  const [location, setLocation] = useState('Beijing');
  const [error, setError] = useState<string | null>(null);

  const loadExecutions = async () => {
    try {
      const data = await apiClient.listExecutions();
      setExecutions(data);
    } catch (err) {
      console.error('Failed to load executions:', err);
      // Set empty array to prevent undefined errors
      setExecutions([]);
    }
  };

  const loadState = async (execId: string) => {
    try {
      const data = await apiClient.getState(execId);
      setState(data);
    } catch (err) {
      console.error('Failed to load state:', err);
      // Don't set state on error, keep previous state or null
    }
  };

  const handleCreateExecution = async () => {
    if (!name || !location) return;

    setIsCreating(true);
    setError(null);

    try {
      const exec = await apiClient.execute({ name, location });
      setSelectedExecution(exec.id);
      // Immediately load the state for the new execution
      loadState(exec.id);
      loadExecutions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create execution');
    } finally {
      setIsCreating(false);
    }
  };

  const handleResume = async () => {
    if (!selectedExecution) return;

    try {
      await apiClient.resumeExecution(selectedExecution);
      loadExecutions();
      loadState(selectedExecution);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume execution');
    }
  };

  // Setup WebSocket when execution is selected
  useEffect(() => {
    if (selectedExecution && state?.status === 'interrupted') {
      const client = new WebSocketClient(selectedExecution);
      client.connect();

      client.on((event: WebSocketEvent) => {
        console.log('[WS] Event:', event);

        if (event.type === 'state_update') {
          const data = event.data as any;
          if (data.execution_id === selectedExecution) {
            loadState(selectedExecution);
            loadExecutions();
          }
        }

        if (event.type === 'execution_started' || event.type === 'execution_completed') {
          loadExecutions();
          loadState(selectedExecution);
        }

        if (event.type === 'error') {
          const errData = event.data as { error: string };
          setError(errData.error);
        }
      });

      return () => {
        client.disconnect();
      };
    }
  }, [selectedExecution, state?.status]);

  // Poll for updates when not in interrupted state
  useEffect(() => {
    if (selectedExecution) {
      loadState(selectedExecution);

      const interval = setInterval(() => {
        loadState(selectedExecution);
        loadExecutions();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [selectedExecution]);

  useEffect(() => {
    loadExecutions();
    const interval = setInterval(loadExecutions, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleConfirmed = () => {
    if (selectedExecution) {
      loadState(selectedExecution);
      loadExecutions();
    }
  };

  const handleRejected = () => {
    if (selectedExecution) {
      loadState(selectedExecution);
      loadExecutions();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">HITL Dashboard</h1>
          <p className="text-gray-400">Human-In-The-Loop AI Agent Workflow</p>
        </header>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-6">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-200 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* New Execution Form */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">New Execution</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter name"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-2">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter location"
                />
              </div>
              <button
                onClick={handleCreateExecution}
                disabled={isCreating || !name || !location}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Start Execution'}
              </button>
            </div>
          </div>

          {/* Executions List */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Executions</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {executions.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No executions</p>
              ) : (
                executions.map((exec) => (
                  <div
                    key={exec.id}
                    onClick={() => setSelectedExecution(exec.id)}
                    className={`p-3 rounded cursor-pointer transition-colors ${
                      selectedExecution === exec.id
                        ? 'bg-blue-600'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium text-sm">{exec.id}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          exec.status === 'completed'
                            ? 'bg-green-600'
                            : exec.status === 'error'
                            ? 'bg-red-600'
                            : exec.status === 'interrupted'
                            ? 'bg-yellow-600'
                            : 'bg-blue-600'
                        }`}
                      >
                        {exec.status}
                      </span>
                    </div>
                    <div className="text-gray-400 text-xs">
                      {new Date(exec.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Checkpoints */}
          <div className="lg:col-span-1">
            <CheckpointList />
          </div>
        </div>

        {/* Execution Details */}
        {selectedExecution && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">
                Execution: {selectedExecution}
              </h2>
              {state?.status === 'interrupted' && (
                <button
                  onClick={handleResume}
                  className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Resume Execution
                </button>
              )}
            </div>

            {!state ? (
              <div className="bg-gray-800 rounded-lg p-12 text-center">
                <div className="animate-pulse text-gray-400">Loading execution state...</div>
              </div>
            ) : (
              <>
                <WorkflowGraph
                  currentNode={state.current_node}
                  status={state.status}
                  messageHistory={state.message_history}
                  nodeExecutionLog={state.node_execution_log}
                  result={state.result}
                  error={state.error}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <MessageHistory messages={state.message_history} />
                  <StateInspector state={state} />
                </div>

                {state.status === 'interrupted' && state.pending_tool_calls && state.pending_tool_calls.length > 0 && (
                  <ToolCallConfirm
                    executionId={selectedExecution!}
                    toolCalls={state.pending_tool_calls}
                    onConfirmed={handleConfirmed}
                    onRejected={handleRejected}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
