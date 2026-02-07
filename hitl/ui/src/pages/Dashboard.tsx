import { useState, useEffect } from 'react';
import { ExecutionInfo, StateResponse, WebSocketEvent } from '../api/types';
import { apiClient } from '../api/client';
import { WebSocketClient } from '../api/websocket';
import { WorkflowGraph } from '../components/WorkflowGraph';
import { StateInspector } from '../components/StateInspector';
import { CheckpointList } from '../components/CheckpointList';
import { MessageHistory } from '../components/MessageHistory';
import { Button, Card, Input, StatusBadge, Icons } from '../components/ui';
import { theme } from '../theme';

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
    <div className={`min-h-screen ${theme.colors.background.primary} ${theme.colors.background.secondary} bg-gradient-to-br text-white`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-1 h-10 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
              <div>
                <h1 className={`text-3xl ${theme.fontWeight.bold} text-white tracking-tight`}>HITL Dashboard</h1>
                <p className={`text-slate-400 text-sm`}>Human-In-The-Loop AI Agent Workflow</p>
              </div>
            </div>
            {isEditing && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <Icons.Alert className="text-amber-400 w-4 h-4" />
                <span className="text-amber-400 text-sm font-medium">Editing mode - polling paused</span>
              </div>
            )}
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="mb-6">
            <Card padding="md" className="border-red-700/50 bg-red-900/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icons.Alert className="text-red-400" />
                  <span className="text-red-100">{error}</span>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-200 hover:text-white transition-colors"
                >
                  <Icons.X />
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* Top Section Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* New Execution Card */}
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <Icons.Plus className="text-blue-400" />
              <h2 className={`text-xl ${theme.fontWeight.semibold} text-white`}>New Execution</h2>
            </div>
            <div className="space-y-4">
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter name"
                disabled={isEditing}
              />
              <Input
                label="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter location"
                disabled={isEditing}
              />
              <Button
                variant="primary"
                onClick={handleCreateExecution}
                loading={isCreating}
                disabled={!name || !location || isEditing}
                fullWidth
              >
                {isCreating ? 'Creating...' : 'Start Execution'}
              </Button>
            </div>
          </Card>

          {/* Executions List Card */}
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <Icons.Clipboard className="text-emerald-400" />
              <h2 className={`text-xl ${theme.fontWeight.semibold} text-white`}>Executions</h2>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {executions.length === 0 ? (
                <div className={`text-slate-400 text-center py-8`}>
                  <Icons.Clipboard className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No executions</p>
                </div>
              ) : (
                executions.map((exec) => (
                  <div
                    key={exec.id}
                    onClick={() => setSelectedExecution(exec.id)}
                    className={`p-3 rounded-lg cursor-pointer ${theme.transitions.normal} ${
                      selectedExecution === exec.id
                        ? 'bg-blue-600 shadow-lg shadow-blue-500/30'
                        : 'bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-white ${theme.fontWeight.medium} text-sm`}>{exec.id}</span>
                      <StatusBadge status={exec.status as 'completed' | 'error' | 'interrupted' | 'pending' | 'running'} />
                    </div>
                    <div className={'text-slate-400 text-xs'}>
                      {new Date(exec.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Checkpoints Card */}
          <div className="lg:col-span-1">
            <CheckpointList />
          </div>
        </div>

        {/* Execution Details */}
        {selectedExecution && (
          <div className="space-y-6">
            {/* Selected Execution Header */}
            <Card padding="lg" className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                <div>
                  <h2 className={`text-xl ${theme.fontWeight.semibold} text-white`}>
                    Execution: <span className="font-mono text-blue-400">{selectedExecution}</span>
                  </h2>
                  {state && (
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={state.status} />
                      <span className={`text-slate-500 text-xs`}>Current: {state.current_node}</span>
                    </div>
                  )}
                </div>
              </div>
              {state?.status === 'interrupted' && !isEditing && (
                <Button variant="success" onClick={handleResume}>
                  <div className="flex items-center gap-2">
                    <Icons.Play />
                    Resume Execution
                  </div>
                </Button>
              )}
            </Card>

            {!state ? (
              <Card padding="lg" className="text-center">
                <div className="animate-pulse flex flex-col items-center gap-3 text-slate-400">
                  <Icons.Loading />
                  <span>Loading execution state...</span>
                </div>
              </Card>
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
