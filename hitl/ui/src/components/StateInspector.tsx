import { useState } from 'react';
import { StateResponse } from '../api/types';

interface StateInspectorProps {
  state: StateResponse;
}

type Tab = 'context' | 'messages' | 'logs';

export function StateInspector({ state }: StateInspectorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('context');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSections(newExpanded);
  };

  const renderJSON = (data: unknown, indent = 0) => {
    const spacing = '  '.repeat(indent);
    if (data === null) {
      return <span className="json-null">null</span>;
    }
    if (typeof data === 'boolean') {
      return <span className="json-boolean">{String(data)}</span>;
    }
    if (typeof data === 'number') {
      return <span className="json-number">{String(data)}</span>;
    }
    if (typeof data === 'string') {
      return <span className="json-string">"{data}"</span>;
    }
    if (Array.isArray(data)) {
      if (data.length === 0) return <span>[]</span>;
      return (
        <span>
          [
          {data.map((item, idx) => (
            <div key={idx}>
              {spacing}  {renderJSON(item, indent + 1)}
              {idx < data.length - 1 ? ',' : ''}
            </div>
          ))}
          {spacing}]
        </span>
      );
    }
    if (typeof data === 'object') {
      const entries = Object.entries(data as Record<string, unknown>);
      if (entries.length === 0) return <span>{'{}'}</span>;
      return (
        <span>
          {'{'}
          {entries.map(([key, value], idx) => (
            <div key={key}>
              {spacing}  <span className="json-key">"{key}"</span>: {renderJSON(value, indent + 1)}
              {idx < entries.length - 1 ? ',' : ''}
            </div>
          ))}
          {spacing}{'}'}
        </span>
      );
    }
    return <span>{String(data)}</span>;
  };

  const renderContext = () => (
    <div className="space-y-2">
      {!state.context || Object.keys(state.context).length === 0 ? (
        <p className="text-gray-400">No context data</p>
      ) : (
        Object.entries(state.context).map(([key, value]) => (
          <div key={key} className="bg-gray-700 rounded p-3">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection(key)}
            >
              <span className="text-white font-medium">{key}</span>
              <span className="text-gray-400 text-xs">
                {expandedSections.has(key) ? '▼' : '▶'}
              </span>
            </div>
            {expandedSections.has(key) && (
              <pre className="mt-2 text-sm text-gray-300 overflow-x-auto font-mono">
                {renderJSON(value)}
              </pre>
            )}
          </div>
        ))
      )}
    </div>
  );

  const renderMessages = () => (
    <div className="space-y-3">
      {state.message_history.length === 0 ? (
        <p className="text-gray-400">No messages</p>
      ) : (
        state.message_history.map((msg, idx) => (
          <div key={idx} className="bg-gray-700 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium capitalize">{msg.role}</span>
              <span className="text-gray-400 text-xs">Message {idx + 1}</span>
            </div>
            {msg.content && (
              <div className="text-gray-300 text-sm mb-2">
                <span className="text-gray-500">Content: </span>
                {msg.content.length > 200 ? msg.content.substring(0, 200) + '...' : msg.content}
              </div>
            )}
            {msg.tool_calls && msg.tool_calls.length > 0 && (
              <div className="mt-2">
                <div className="text-gray-400 text-sm mb-1">Tool Calls:</div>
                {msg.tool_calls.map((tc, tcIdx) => (
                  <div key={tcIdx} className="bg-gray-800 rounded p-2 text-sm">
                    <div className="text-blue-400 font-medium">{tc.name}</div>
                    <pre className="text-gray-400 text-xs mt-1 overflow-x-auto">
                      {tc.args}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-2">
      {!state.node_execution_log || Object.keys(state.node_execution_log).length === 0 ? (
        <p className="text-gray-400">No execution logs</p>
      ) : (
        Object.entries(state.node_execution_log).map(([node, log]) => (
          <div key={node} className="bg-gray-700 rounded p-3">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">{node}</span>
            </div>
            <pre className="mt-2 text-sm text-gray-300 overflow-x-auto font-mono">
              {renderJSON(log)}
            </pre>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('context')}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            activeTab === 'context'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Context
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            activeTab === 'messages'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Messages ({state.message_history?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            activeTab === 'logs'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Node Logs
        </button>
      </div>

      <div className="min-h-[300px]">
        {activeTab === 'context' && renderContext()}
        {activeTab === 'messages' && renderMessages()}
        {activeTab === 'logs' && renderLogs()}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-500">
        <div>Current Node: {state.current_node}</div>
        <div>Status: {state.status}</div>
        <div>Last Updated: {new Date(state.saved_at / 1000000).toLocaleString()}</div>
      </div>
    </div>
  );
}
