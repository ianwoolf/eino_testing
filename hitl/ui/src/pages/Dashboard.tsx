import { useState, useEffect } from 'react';
import { ExecutionInfo, StateResponse, WebSocketEvent } from '../api/types';
import { apiClient } from '../api/client';
import { WebSocketClient } from '../api/websocket';
import { WorkflowGraph } from '../components/WorkflowGraph';
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
  const [isEditing, setIsEditing] = useState(false);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const loadExecutions = async () => {
    try {
      const data = await apiClient.listExecutions();
      setExecutions(data);
    } catch (err) {
      console.error('Failed to load executions:', err);
      setExecutions([]);
    }
  };

  const loadState = async (execId: string) => {
    try {
      const data = await apiClient.getState(execId);
      setState(data);
    } catch (err) {
      console.error('Failed to load state:', err);
    }
  };

  const handleCreateExecution = async () => {
    if (!name || !location) return;

    setIsCreating(true);
    setError(null);

    try {
      const exec = await apiClient.execute({ name, location });
      setSelectedExecution(exec.id);
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

  const handleEditingChange = (editing: boolean) => {
    setIsEditing(editing);
    if (editing && pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  };

  useEffect(() => {
    if (selectedExecution && state?.status === 'interrupted' && !isEditing) {
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
  }, [selectedExecution, state?.status, isEditing]);

  useEffect(() => {
    if (selectedExecution && !isEditing) {
      loadState(selectedExecution);

      const interval = setInterval(() => {
        loadState(selectedExecution);
        loadExecutions();
      }, 2000);

      setPollInterval(interval);

      return () => clearInterval(interval);
    }
  }, [selectedExecution, isEditing]);

  useEffect(() => {
    loadExecutions();
    const interval = setInterval(loadExecutions, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleConfirmed = () => {
    setIsEditing(false);
    if (selectedExecution) {
      loadState(selectedExecution);
      loadExecutions();
    }
  };

  const handleRejected = () => {
    setIsEditing(false);
    if (selectedExecution) {
      loadState(selectedExecution);
      loadExecutions();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-1 h-10 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">HITL Dashboard</h1>
              <p className="text-slate-400 text-sm">Human-In-The-Loop AI Agent Workflow</p>
            </div>
          </div>
          {isEditing && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-amber-400 text-sm font-medium">Editing mode - polling paused</span>
            </div>
          )}
        </header>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-100 px-4 py-3 rounded-xl mb-6 flex items-center justify-between backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-200 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Execution
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900/50 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                  placeholder="Enter name"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900/50 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                  placeholder="Enter location"
                />
              </div>
              <button
                onClick={handleCreateExecution}
                disabled={isCreating || !name || !location || isEditing}
                className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed font-medium transition-all shadow-lg hover:shadow-blue-500/25"
              >
                {isCreating ? 'Creating...' : 'Start Execution'}
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Executions
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {executions.length === 0 ? (
                <div className="text-slate-400 text-center py-8">
                  <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-sm">No executions</p>
                </div>
              ) : (
                executions.map((exec) => (
                  <div
                    key={exec.id}
                    onClick={() => setSelectedExecution(exec.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedExecution === exec.id
                        ? 'bg-blue-600 shadow-lg shadow-blue-500/30'
                        : 'bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium text-sm">{exec.id}</span>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                          exec.status === 'completed'
                            ? 'bg-emerald-600/80 text-white'
                            : exec.status === 'error'
                            ? 'bg-red-600/80 text-white'
                            : exec.status === 'interrupted'
                            ? 'bg-amber-500/80 text-white'
                            : exec.status === 'pending'
                            ? 'bg-orange-600/80 text-white'
                            : 'bg-blue-600/80 text-white'
                        }`}
                      >
                        {exec.status}
                      </span>
                    </div>
                    <div className="text-slate-400 text-xs">
                      {new Date(exec.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <CheckpointList />
          </div>
        </div>

        {selectedExecution && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-5 shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Execution: <span className="font-mono text-blue-400">{selectedExecution}</span>
                  </h2>
                  {state && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                        state.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : state.status === 'error'
                          ? 'bg-red-500/20 text-red-400'
                          : state.status === 'interrupted'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {state.status}
                      </span>
                      <span className="text-slate-500 text-xs">Current: {state.current_node}</span>
                    </div>
                  )}
                </div>
              </div>
              {state?.status === 'interrupted' && !isEditing && (
                <button
                  onClick={handleResume}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-all shadow-lg hover:shadow-emerald-500/25"
                >
                  Resume Execution
                </button>
              )}
            </div>

            {!state ? (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-16 text-center shadow-lg">
                <div className="animate-pulse text-slate-400 flex flex-col items-center gap-3">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Loading execution state...</span>
                </div>
              </div>
            ) : (
              <>
                <WorkflowGraph
                  currentNode={state.current_node}
                  status={state.status}
                  messageHistory={state.message_history}
                  nodeExecutionLog={state.node_execution_log}
                  executionId={selectedExecution}
                  result={state.result}
                  error={state.error}
                  onToolConfirmed={handleConfirmed}
                  onToolRejected={handleRejected}
                  isEditing={isEditing}
                  onEditingChange={handleEditingChange}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <MessageHistory messages={state.message_history} />
                  <StateInspector state={state} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
