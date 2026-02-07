import { useState, useEffect, useCallback } from 'react';
import { MessageResponse, ToolCallResponse } from '../api/types';
import { apiClient } from '../api/client';
import { Card, Button, Icons, NodeStatusIndicator } from './ui';
import { theme } from '../theme';

interface WorkflowGraphProps {
  currentNode: string;
  status: string;
  messageHistory: MessageResponse[];
  nodeExecutionLog: Record<string, unknown>;
  executionId?: string;
  result?: string;
  error?: string;
  onToolConfirmed?: () => void;
  onToolRejected?: () => void;
  isEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

const nodes = [
  { id: 'ChatTemplate', label: 'Chat Template', x: 50, y: 100 },
  { id: 'ChatModel', label: 'Chat Model', x: 250, y: 100 },
  { id: 'ToolsNode', label: 'Tools Node', x: 450, y: 100 },
  { id: 'END', label: 'End', x: 650, y: 100 },
];

const edges = [
  { from: 'ChatTemplate', to: 'ChatModel' },
  { from: 'ChatModel', to: 'ToolsNode' },
  { from: 'ChatModel', to: 'END' },
  { from: 'ToolsNode', to: 'ChatModel' },
];

export function WorkflowGraph({
  currentNode,
  status,
  messageHistory,
  nodeExecutionLog,
  executionId,
  result,
  error,
  onToolConfirmed,
  onToolRejected,
  isEditing: externalIsEditing = false,
  onEditingChange,
}: WorkflowGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [editingStates, setEditingStates] = useState<{
    [key: number]: {
      isEditing: boolean;
      editedArgs: string;
      originalArgs: string;
    }
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [nodeError, setNodeError] = useState<string | null>(null);
  const [internalIsEditing, setInternalIsEditing] = useState(false);

  const isEditing = externalIsEditing || internalIsEditing;

  const getToolCalls = (): ToolCallResponse[] => {
    if (!messageHistory || messageHistory.length === 0) return [];
    const lastMsg = messageHistory[messageHistory.length - 1];
    if (lastMsg.role === 'assistant' && lastMsg.tool_calls) {
      return lastMsg.tool_calls;
    }
    return [];
  };

  const toolCalls = getToolCalls();

  useEffect(() => {
    const initialStates: {
      [key: number]: {
        isEditing: boolean;
        editedArgs: string;
        originalArgs: string;
      }
    } = {};
    toolCalls.forEach((toolCall, index) => {
      initialStates[index] = {
        isEditing: false,
        editedArgs: toolCall.args,
        originalArgs: toolCall.args,
      };
    });
    setEditingStates(initialStates);
  }, [toolCalls]);

  const getNodeStatus = useCallback((): 'pending' | 'running' | 'completed' | 'interrupted' => {
    if (status === 'completed' && currentNode === 'END') {
      return 'completed';
    }
    if (status === 'interrupted') {
      return 'interrupted';
    }
    if (status === 'running') {
      return 'running';
    }
    if (status === 'pending') {
      return 'pending';
    }
    if (messageHistory && messageHistory.length > 0) {
      if (currentNode === 'ChatTemplate') return 'completed';
      if (currentNode === 'ChatModel') return 'completed';
      if (currentNode === 'ToolsNode') return 'interrupted';
    }
    return 'pending';
  }, [currentNode, status, messageHistory]);

  const getNodeColor = (nodeStatus: 'pending' | 'running' | 'completed' | 'interrupted'): string => {
    switch (nodeStatus) {
      case 'pending':
        return 'fill-slate-800 stroke-slate-600';
      case 'running':
        return 'fill-blue-600 stroke-blue-400';
      case 'completed':
        return 'fill-emerald-600 stroke-emerald-400';
      case 'interrupted':
        return 'fill-amber-500 stroke-amber-300';
      default:
        return 'fill-slate-800 stroke-slate-600';
    }
  };

  const isNodeCompleted = useCallback((nodeId: string): boolean => {
    const completedNodes = ['ChatTemplate', 'ChatModel'];
    if (completedNodes.includes(nodeId)) {
      return true;
    }
    if (status === 'completed') {
      if (nodeId === 'END' || nodeId === 'ToolsNode') {
        return true;
      }
    }
    if (status === 'interrupted' && nodeId === 'ToolsNode') {
      return true;
    }
    return false;
  }, [status]);

  const isEdgeActive = useCallback((from: string, to: string): boolean => {
    const currentStatus = getNodeStatus();

    if (currentStatus === 'completed' && to === 'END') {
      return true;
    }

    if (status === 'interrupted' && from === 'ChatModel' && to === 'ToolsNode') {
      return true;
    }

    if (status === 'interrupted' && from === 'ToolsNode') {
      return true;
    }

    if (messageHistory && messageHistory.length > 0) {
      if (from === 'ChatTemplate' && to === 'ChatModel') {
        return true;
      }
      if (from === 'ChatModel' && (to === 'ToolsNode' || to === 'END')) {
        return true;
      }
      if (from === 'ToolsNode' && to === 'ChatModel') {
        return true;
      }
    }

    return false;
  }, [status, messageHistory, getNodeStatus]);

  const hasLogs = (nodeId: string) => {
    if (nodeId === 'END') {
      return status === 'completed' && (result !== undefined || error !== undefined);
    }
    if (!nodeExecutionLog) return false;
    return Object.keys(nodeExecutionLog).some(key => key.includes(nodeId));
  };

  const renderJSON = (data: unknown): string => {
    if (data === null) return 'null';
    if (typeof data === 'boolean') return String(data);
    if (typeof data === 'number') return String(data);
    if (typeof data === 'string') return `"${data}"`;
    if (Array.isArray(data)) return `Array(${data.length})`;
    if (typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      return JSON.stringify(obj, null, 2);
    }
    return String(data);
  };

  const getNodeLogs = (nodeId: string) => {
    const logs: Array<{ key: string; value: unknown }> = [];

    if (!nodeExecutionLog) return logs;

    Object.entries(nodeExecutionLog).forEach(([key, value]) => {
      if (key.includes(nodeId) || nodeId === 'ChatModel' && key.includes('ChatModel')) {
        logs.push({ key, value });
      }
    });

    return logs;
  };

  const formatJSON = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  };

  const validateJSON = (jsonString: string): boolean => {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  };

  const hasChanges = (index: number) => {
    const state = editingStates[index];
    if (!state) return false;
    return state.editedArgs !== state.originalArgs;
  };

  const isValid = (index: number) => {
    const state = editingStates[index];
    if (!state) return true;
    return validateJSON(state.editedArgs);
  };

  const startEditing = useCallback((index: number) => {
    setEditingStates(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        isEditing: true,
      },
    }));
    setInternalIsEditing(true);
    onEditingChange?.(true);
  }, [onEditingChange]);

  const cancelEditing = useCallback((index: number) => {
    setEditingStates(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        isEditing: false,
        editedArgs: prev[index].originalArgs,
      },
    }));
    const stillEditing = Object.values(editingStates).some(s => s.isEditing);
    if (!stillEditing) {
      setInternalIsEditing(false);
      onEditingChange?.(false);
    }
  }, [editingStates, onEditingChange]);

  const updateArgs = useCallback((index: number, newArgs: string) => {
    setEditingStates(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        editedArgs: newArgs,
      },
    }));
  }, []);

  const handleConfirm = useCallback(async (index: number) => {
    if (!executionId) return;

    setIsLoading(true);
    setNodeError(null);

    try {
      const state = editingStates[index];
      if (state.isEditing && state.editedArgs !== state.originalArgs) {
        await apiClient.confirm({
          execution_id: executionId,
          action: 'reject',
          new_args: state.editedArgs,
        });
      } else {
        await apiClient.confirm({
          execution_id: executionId,
          action: 'confirm',
        });
      }

      if (state.isEditing && state.editedArgs !== state.originalArgs) {
        onToolRejected?.();
      } else {
        onToolConfirmed?.();
      }

      setEditingStates(prev => ({
        ...prev,
        [index]: {
          ...prev[index],
          isEditing: false,
        },
      }));
      setInternalIsEditing(false);
      onEditingChange?.(false);
    } catch (err) {
      setNodeError(err instanceof Error ? err.message : 'Failed to submit confirmation');
    } finally {
      setIsLoading(false);
    }
  }, [executionId, editingStates, onToolConfirmed, onToolRejected, onEditingChange]);

  const renderToolCalls = () => {
    if (toolCalls.length === 0) {
      return (
        <div className="text-center py-8">
          <div className={`text-slate-500 text-sm`}>No pending tool calls</div>
        </div>
      );
    }

    const isCompleted = status === 'completed';

    return (
      <div className="space-y-4">
        {toolCalls.map((toolCall, index) => {
          const state = editingStates[index];
          const isCurrentlyEditing = state?.isEditing || false;
          const currentArgs = state?.editedArgs || toolCall.args;
          const hasChangesMade = hasChanges(index);
          const isCurrentValid = isValid(index);

          return (
            <Card key={toolCall.id || index} padding="lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                  <h5 className={`text-white ${theme.fontWeight.semibold}`}>{toolCall.name}</h5>
                </div>
                <span className={`text-slate-500 text-xs font-mono`}>ID: {toolCall.id?.substring(0, 8)}...</span>
              </div>

              <div className="mb-4">
                <label className={`block text-slate-300 text-sm ${theme.fontWeight.medium} mb-2`}>
                  {isCurrentlyEditing ? 'Edited Arguments:' : 'Arguments:'}
                </label>

                {isCurrentlyEditing ? (
                  <>
                    <textarea
                      value={currentArgs}
                      onChange={(e) => updateArgs(index, e.target.value)}
                      className="w-full h-40 bg-slate-900 text-slate-100 font-mono text-sm p-4 rounded-lg border-2 border-amber-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                      spellCheck={false}
                    />
                    {!isCurrentValid && (
                      <p className="text-red-400 text-sm mt-2 flex items-center gap-2">
                        <Icons.Alert className="w-4 h-4" />
                        Invalid JSON format
                      </p>
                    )}
                    {hasChangesMade && isCurrentValid && (
                      <p className="text-amber-400 text-sm mt-2 flex items-center gap-2">
                        <Icons.Alert className="w-4 h-4" />
                        Modified from original
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <pre className="bg-slate-900 text-slate-100 font-mono text-sm p-4 rounded-lg overflow-x-auto border border-slate-700">
                      {formatJSON(currentArgs)}
                    </pre>
                    {hasChangesMade && (
                      <p className="text-amber-400 text-sm mt-2 flex items-center gap-2">
                        <Icons.Alert className="w-4 h-4" />
                        Modified (not yet submitted)
                      </p>
                    )}
                  </>
                )}
              </div>

              {!isCompleted && (
                <div className="flex gap-2">
                  {isCurrentlyEditing ? (
                    <>
                      <Button
                        variant="primary"
                        onClick={() => handleConfirm(index)}
                        disabled={isLoading || !isCurrentValid}
                      >
                        {isLoading ? 'Submitting...' : (hasChangesMade ? 'Submit Modified' : 'Confirm')}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => cancelEditing(index)}
                        disabled={isLoading}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="success"
                        onClick={() => handleConfirm(index)}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Confirming...' : 'Confirm'}
                      </Button>
                      <Button
                        variant="warning"
                        onClick={() => startEditing(index)}
                        disabled={isLoading}
                      >
                        <div className="flex items-center gap-1">
                          <Icons.Edit className="w-4 h-4" />
                          Edit
                        </div>
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  };

  const renderNodeDetails = (nodeId: string) => {
    if (nodeId === 'END') {
      if (error) {
        return (
          <Card padding="md" className="border-red-700 bg-red-900/20">
            <div className="flex items-center gap-2 mb-2">
              <Icons.Alert className="text-red-400 w-5 h-5" />
              <h5 className={`text-red-200 text-sm ${theme.fontWeight.medium}`}>Execution Error</h5>
            </div>
            <p className="text-red-100">{error}</p>
          </Card>
        );
      }
      if (result !== undefined) {
        return (
          <Card padding="md" className="border-emerald-700 bg-emerald-900/20">
            <div className="flex items-center gap-2 mb-2">
              <Icons.Check className="text-emerald-400 w-5 h-5" />
              <h5 className={`text-emerald-200 text-sm ${theme.fontWeight.medium}`}>Final Result</h5>
            </div>
            <p className="text-emerald-100">{result}</p>
          </Card>
        );
      }
      return (
        <div className={`text-slate-500 text-sm`}>
          {status === 'completed' ? 'Execution completed' : 'Execution not yet completed'}
        </div>
      );
    }

    if (nodeId === 'ToolsNode') {
      return renderToolCalls();
    }

    const logs = getNodeLogs(nodeId);
    if (logs.length === 0) {
      return <p className={`text-slate-500 text-sm`}>No logs available for this node</p>;
    }

    return (
      <div className="space-y-2">
        {logs.map((log, idx) => (
          <Card key={idx} padding="sm" className="bg-slate-900/50">
            <div className={`text-slate-400 text-xs mb-2 font-mono`}>{log.key}</div>
            <pre className={`text-sm text-slate-300 overflow-x-auto font-mono`}>
              {renderJSON(log.value)}
            </pre>
          </Card>
        ))}
      </div>
    );
  };

  const nodeStatus = getNodeStatus();
  const currentNodeLabel = nodes.find(n => n.id === currentNode)?.label || currentNode;

  return (
    <Card padding="lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
          <h3 className={`text-white ${theme.fontWeight.semibold} text-lg tracking-tight`}>Workflow Graph</h3>
        </div>
        {selectedNode && !isEditing && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedNode(null)}
          >
            <div className="flex items-center gap-1">
              Close Details
              <Icons.X className="w-4 h-4" />
            </div>
          </Button>
        )}
      </div>

      {/* Node Error */}
      {nodeError && (
        <Card padding="md" className="mb-4 border-red-700 bg-red-900/30">
          <div className="text-red-100 flex items-center gap-2">
            <Icons.Alert className="w-5 h-5" />
            {nodeError}
          </div>
        </Card>
      )}

      {/* Node Details Panel */}
      {selectedNode && (
        <Card padding="lg" className="mb-6 bg-slate-900/80">
          <h4 className={`${theme.text.primary} ${theme.fontWeight.medium} mb-4 flex items-center gap-3`}>
            <NodeStatusIndicator status={nodeStatus} />
            {nodes.find(n => n.id === selectedNode)?.label}
            {selectedNode === 'END' && ' - Final Result'}
            {selectedNode === 'ToolsNode' && ' - Tool Calls'}
            {selectedNode !== 'END' && selectedNode !== 'ToolsNode' && ' - Execution Log'}
          </h4>
          {renderNodeDetails(selectedNode)}
        </Card>
      )}

      {/* SVG Graph */}
      <svg className="w-full" viewBox="0 0 750 200" style={{ maxHeight: selectedNode ? '150px' : '200px' }}>
        {edges.map((edge, idx) => {
          const isActive = isEdgeActive(edge.from, edge.to);
          const isCurrentEdge =
            (status === 'interrupted' && edge.from === 'ChatModel' && edge.to === 'ToolsNode') ||
            (status === 'completed' && edge.from === 'ChatModel' && edge.to === 'END');

          return (
            <g key={`edge-${idx}`}>
              {isActive && (
                <line
                  x1={nodes.find((n) => n.id === edge.from)!.x + 75}
                  y1={nodes.find((n) => n.id === edge.from)!.y + 30}
                  x2={nodes.find((n) => n.id === edge.to)!.x}
                  y2={nodes.find((n) => n.id === edge.to)!.y + 30}
                  stroke={status === 'completed' ? '#10b981' : '#3b82f6'}
                  strokeWidth="8"
                  strokeOpacity="0.2"
                  strokeLinecap="round"
                />
              )}
              <line
                x1={nodes.find((n) => n.id === edge.from)!.x + 75}
                y1={nodes.find((n) => n.id === edge.from)!.y + 30}
                x2={nodes.find((n) => n.id === edge.to)!.x}
                y2={nodes.find((n) => n.id === edge.to)!.y + 30}
                stroke={isActive ? (status === 'completed' ? '#10b981' : '#3b82f6') : '#475569'}
                strokeWidth={isActive ? '3' : '2'}
                strokeDasharray={isActive ? '0' : '6,4'}
                markerEnd={`url(#arrowhead-${isActive ? 'active' : 'inactive'})`}
                className={isCurrentEdge ? 'transition-all duration-500' : ''}
              />
            </g>
          );
        })}

        <defs>
          <marker
            id="arrowhead-active"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={status === 'completed' ? '#10b981' : '#3b82f6'} />
          </marker>
          <marker
            id="arrowhead-inactive"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#475569" />
          </marker>
        </defs>

        {nodes.map((node) => {
          const isCurrentNode = currentNode === node.id;
          const nodeCompleted = isNodeCompleted(node.id);
          const nodeColor = isCurrentNode ? nodeStatus : (nodeCompleted ? 'completed' : 'pending');
          const colorClass = getNodeColor(nodeColor);
          const isSelected = selectedNode === node.id;
          const nodeHasLogs = hasLogs(node.id);
          const isHighlighted = (status === 'completed' && node.id === 'END') ||
                               (status === 'interrupted' && node.id === 'ToolsNode');

          return (
            <g key={node.id} onClick={() => !isEditing && setSelectedNode(node.id)}>
              {isSelected && !isEditing && (
                <rect
                  x={node.x - 4}
                  y={node.y - 4}
                  width="158"
                  height="68"
                  rx="12"
                  className="fill-blue-500/20 stroke-blue-400 stroke-2"
                />
              )}

              {isHighlighted && (
                <rect
                  x={node.x - 6}
                  y={node.y - 6}
                  width="162"
                  height="72"
                  rx="14"
                  fill="none"
                  stroke={status === 'completed' ? '#10b981' : '#f59e0b'}
                  strokeWidth="3"
                  className={status === 'completed' ? 'animate-pulse' : 'animate-pulse'}
                  style={{ filter: `drop-shadow(0 0 12px ${status === 'completed' ? 'rgba(16, 185, 129, 0.6)' : 'rgba(245, 158, 11, 0.6)'})` }}
                />
              )}

              <rect
                x={node.x}
                y={node.y}
                width="150"
                height="60"
                rx="10"
                className={`${colorClass} ${isCurrentNode ? 'cursor-pointer hover:brightness-110 transition-all' : ''}`}
                strokeWidth="2"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' }}
              />
              <text
                x={node.x + 75}
                y={node.y + 35}
                textAnchor="middle"
                fill="white"
                fontSize="14"
                fontWeight="600"
                pointerEvents="none"
                style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}
              >
                {node.label}
              </text>

              {nodeHasLogs && (
                <circle
                  cx={node.x + 138}
                  cy={node.y + 12}
                  r="5"
                  fill={node.id === 'END' ? '#10b981' : '#60a5fa'}
                  pointerEvents="none"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(96, 165, 250, 0.8))' }}
                />
              )}

              {nodeCompleted && !isHighlighted && (
                <circle
                  cx={node.x + 15}
                  cy={node.y + 15}
                  r="7"
                  fill="#10b981"
                  stroke="#064e3b"
                  strokeWidth="2"
                  pointerEvents="none"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.6))' }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-5 mt-5 text-xs text-slate-400 flex-wrap border-t border-slate-700/50 pt-4">
        <NodeStatusIndicator status="pending" showLabel />
        <NodeStatusIndicator status="running" showLabel />
        <NodeStatusIndicator status="completed" showLabel />
        <NodeStatusIndicator status="interrupted" showLabel />
        {status === 'pending' && (
          <div className="flex items-center gap-2 ml-4 text-amber-400 font-medium">
            <span>Pending at: {currentNodeLabel}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
