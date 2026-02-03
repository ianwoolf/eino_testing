import { useState } from 'react';
import { MessageResponse } from '../api/types';

interface WorkflowGraphProps {
  currentNode: string;
  status: string;
  messageHistory: MessageResponse[];
  nodeExecutionLog: Record<string, unknown>;
  result?: string;
  error?: string;
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
  result,
  error
}: WorkflowGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const getNodeStatus = (nodeId: string): 'pending' | 'running' | 'completed' | 'interrupted' => {
    if (nodeId === currentNode) {
      return status === 'interrupted' ? 'interrupted' : 'running';
    }
    if (status === 'completed' && nodeId === 'END') {
      return 'completed';
    }
    if (messageHistory && messageHistory.length > 0) {
      if (nodeId === 'ChatTemplate') return 'completed';
      if (nodeId === 'ChatModel') return 'completed';
      if (nodeId === 'ToolsNode' && status === 'interrupted') return 'interrupted';
    }
    return 'pending';
  };

  const getNodeColor = (nodeStatus: 'pending' | 'running' | 'completed' | 'interrupted') => {
    switch (nodeStatus) {
      case 'pending':
        return 'fill-gray-700 stroke-gray-600 cursor-pointer hover:fill-gray-600';
      case 'running':
        return 'fill-blue-600 stroke-blue-500 animate-pulse cursor-pointer hover:fill-blue-500';
      case 'completed':
        return 'fill-green-600 stroke-green-500 cursor-pointer hover:fill-green-500';
      case 'interrupted':
        return 'fill-yellow-600 stroke-yellow-500 cursor-pointer hover:fill-yellow-500';
      default:
        return 'fill-gray-700 stroke-gray-600 cursor-pointer hover:fill-gray-600';
    }
  };

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

  const renderNodeDetails = (nodeId: string) => {
    if (nodeId === 'END') {
      if (error) {
        return (
          <div className="bg-red-900 border border-red-700 rounded p-4">
            <h5 className="text-red-200 text-sm font-medium mb-2">Execution Error</h5>
            <p className="text-red-100">{error}</p>
          </div>
        );
      }
      if (result !== undefined) {
        return (
          <div className="bg-green-900 border border-green-700 rounded p-4">
            <h5 className="text-green-200 text-sm font-medium mb-2">Final Result</h5>
            <p className="text-green-100">{result}</p>
          </div>
        );
      }
      return (
        <div className="text-gray-500 text-sm">
          {status === 'completed' ? 'Execution completed' : 'Execution not yet completed'}
        </div>
      );
    }

    const logs = getNodeLogs(nodeId);
    if (logs.length === 0) {
      return <p className="text-gray-500 text-sm">No logs available for this node</p>;
    }

    return (
      <div className="space-y-2">
        {logs.map((log, idx) => (
          <div key={idx} className="bg-gray-800 rounded p-3">
            <div className="text-gray-400 text-xs mb-2 font-mono">{log.key}</div>
            <pre className="text-sm text-gray-300 overflow-x-auto font-mono">
              {renderJSON(log.value)}
            </pre>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Workflow Graph</h3>
        {selectedNode && (
          <button
            onClick={() => setSelectedNode(null)}
            className="text-sm text-gray-400 hover:text-white"
          >
            Close Details ✕
          </button>
        )}
      </div>

      {/* Node Detail Panel */}
      {selectedNode && (
        <div className="mb-4 bg-gray-900 rounded-lg p-4 border border-gray-700">
          <h4 className="text-white font-medium mb-3 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              selectedNode === 'END'
                ? status === 'completed' ? 'bg-green-500' : 'bg-gray-500'
                : 'bg-blue-500'
            }`}></span>
            {nodes.find(n => n.id === selectedNode)?.label}
            {selectedNode === 'END' ? ' - Final Result' : ' - Execution Log'}
          </h4>
          {renderNodeDetails(selectedNode)}
        </div>
      )}

      <svg className="w-full" viewBox="0 0 750 200" style={{ maxHeight: selectedNode ? '150px' : '200px' }}>
        {/* Render edges */}
        {edges.map((edge, idx) => (
          <g key={`edge-${idx}`}>
            <line
              x1={nodes.find((n) => n.id === edge.from)!.x + 75}
              y1={nodes.find((n) => n.id === edge.from)!.y + 30}
              x2={nodes.find((n) => n.id === edge.to)!.x}
              y2={nodes.find((n) => n.id === edge.to)!.y + 30}
              stroke="#4b5563"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          </g>
        ))}

        {/* Arrow marker */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#4b5563" />
          </marker>
        </defs>

        {/* Render nodes */}
        {nodes.map((node) => {
          const nodeStatus = getNodeStatus(node.id);
          const colorClass = getNodeColor(nodeStatus);
          const isSelected = selectedNode === node.id;
          const nodeHasLogs = hasLogs(node.id);

          return (
            <g key={node.id} onClick={() => setSelectedNode(node.id)}>
              {/* Shadow/Selection ring */}
              {isSelected && (
                <rect
                  x={node.x - 3}
                  y={node.y - 3}
                  width="156"
                  height="66"
                  rx="10"
                  className="stroke-blue-400 stroke-2 fill-none"
                />
              )}

              <rect
                x={node.x}
                y={node.y}
                width="150"
                height="60"
                rx="8"
                className={colorClass}
                strokeWidth="2"
              />
              <text
                x={node.x + 75}
                y={node.y + 35}
                textAnchor="middle"
                fill="white"
                fontSize="14"
                fontWeight="500"
                pointerEvents="none"
              >
                {node.label}
              </text>

              {/* Log/Result indicator */}
              {nodeHasLogs && (
                <circle
                  cx={node.x + 140}
                  cy={node.y + 12}
                  r="4"
                  fill={node.id === 'END' ? '#10b981' : '#60a5fa'}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs text-gray-400 flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-700 rounded"></div>
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-600 rounded"></div>
          <span>Running</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-600 rounded"></div>
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-600 rounded"></div>
          <span>Interrupted</span>
        </div>
        <div className="flex items-center gap-1 ml-4">
          <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
          <span>Has Logs</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span>Has Result</span>
        </div>
      </div>
    </div>
  );
}
