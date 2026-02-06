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
        <div className="text-slate-400 text-center py-8">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-sm">No context data</p>
        </div>
      ) : (
        Object.entries(state.context).map(([key, value]) => (
          <div key={key} className="bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 hover:border-slate-500/50 transition-all">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection(key)}
            >
              <span className="text-white font-medium">{key}</span>
              <span className="text-slate-400 text-xs">
                {expandedSections.has(key) ? '▼' : '▶'}
              </span>
            </div>
            {expandedSections.has(key) && (
              <pre className="mt-3 text-sm text-slate-300 overflow-x-auto font-mono bg-slate-900/50 p-3 rounded border border-slate-700/50">
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
        <div className="text-slate-400 text-center py-8">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">No messages</p>
        </div>
      ) : (
        state.message_history.map((msg, idx) => (
          <div key={idx} className="bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 hover:border-slate-500/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium capitalize">{msg.role}</span>
              <span className="text-slate-400 text-xs">Message {idx + 1}</span>
            </div>
            {msg.content && (
              <div className="text-slate-300 text-sm mb-2">
                <span className="text-slate-500">Content: </span>
                {msg.content.length > 200 ? msg.content.substring(0, 200) + '...' : msg.content}
              </div>
            )}
            {msg.tool_calls && msg.tool_calls.length > 0 && (
              <div className="mt-2">
                <div className="text-slate-400 text-sm mb-2">Tool Calls:</div>
                {msg.tool_calls.map((tc, tcIdx) => (
                  <div key={tcIdx} className="bg-slate-900/50 border border-slate-700/50 rounded p-2 text-sm">
                    <div className="text-blue-400 font-medium">{tc.name}</div>
                    <pre className="text-slate-400 text-xs mt-1 overflow-x-auto">
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
        <div className="text-slate-400 text-center py-8">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">No execution logs</p>
        </div>
      ) : (
        Object.entries(state.node_execution_log).map(([node, log]) => (
          <div key={node} className="bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 hover:border-slate-500/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">{node}</span>
            </div>
            <pre className="mt-3 text-sm text-slate-300 overflow-x-auto font-mono bg-slate-900/50 p-3 rounded border border-slate-700/50">
              {renderJSON(log)}
            </pre>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-3 mb-5">
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="text-white font-semibold">State Inspector</h3>
      </div>

      <div className="flex gap-2 mb-5 bg-slate-900/30 p-1.5 rounded-lg">
        <button
          onClick={() => setActiveTab('context')}
          className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
            activeTab === 'context'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          Context
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
            activeTab === 'messages'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          Messages ({state.message_history?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
            activeTab === 'logs'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
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

      <div className="mt-5 pt-4 border-t border-slate-700/50 text-xs text-slate-500 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Current Node:</span>
          <span className="font-mono text-slate-300">{state.current_node}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Status:</span>
          <span className={`font-medium ${
            state.status === 'completed'
              ? 'text-emerald-400'
              : state.status === 'error'
              ? 'text-red-400'
              : state.status === 'interrupted'
              ? 'text-amber-400'
              : 'text-blue-400'
          }`}>{state.status}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Last Updated:</span>
          <span>{new Date(state.saved_at / 1000000).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
