import { useState } from 'react';
import { StateResponse } from '../api/types';
import { Card, Icons, StatusBadge } from './ui';
import { theme } from '../theme';

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
        <div className={`text-slate-400 text-center py-8`}>
          <Icons.Box className="mx-auto mb-2 opacity-30 w-6 h-6" />
          <p className="text-sm">No context data</p>
        </div>
      ) : (
        Object.entries(state.context).map(([key, value]) => (
          <Card key={key} padding="sm" hoverable>
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection(key)}
            >
              <span className={`text-white ${theme.fontWeight.medium}`}>{key}</span>
              <span className={`text-slate-400 text-xs`}>
                {expandedSections.has(key) ? '▼' : '▶'}
              </span>
            </div>
            {expandedSections.has(key) && (
              <pre className={`mt-3 text-sm text-slate-300 overflow-x-auto font-mono bg-slate-900/50 p-3 rounded border border-slate-700/50`}>
                {renderJSON(value)}
              </pre>
            )}
          </Card>
        ))
      )}
    </div>
  );

  const renderMessages = () => (
    <div className="space-y-3">
      {state.message_history.length === 0 ? (
        <div className={`text-slate-400 text-center py-8`}>
          <Icons.Message className="mx-auto mb-2 opacity-30 w-6 h-6" />
          <p className="text-sm">No messages</p>
        </div>
      ) : (
        state.message_history.map((msg, idx) => (
          <Card key={idx} padding="sm" hoverable>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-white ${theme.fontWeight.medium} capitalize`}>{msg.role}</span>
              <span className={`text-slate-400 text-xs`}>Message {idx + 1}</span>
            </div>
            {msg.content && (
              <div className={`text-slate-300 text-sm mb-2`}>
                <span className="text-slate-400">Content: </span>
                {msg.content.length > 200 ? msg.content.substring(0, 200) + '...' : msg.content}
              </div>
            )}
            {msg.tool_calls && msg.tool_calls.length > 0 && (
              <div className="mt-2">
                <div className={`text-slate-400 text-sm mb-2`}>Tool Calls:</div>
                {msg.tool_calls.map((tc, tcIdx) => (
                  <Card key={tcIdx} padding="sm" className="bg-slate-900/50">
                    <div className="text-blue-400 font-medium">{tc.name}</div>
                    <pre className={`text-slate-400 text-xs mt-1 overflow-x-auto`}>
                      {tc.args}
                    </pre>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-2">
      {!state.node_execution_log || Object.keys(state.node_execution_log).length === 0 ? (
        <div className={`text-slate-400 text-center py-8`}>
          <Icons.Clipboard className="mx-auto mb-2 opacity-30 w-6 h-6" />
          <p className="text-sm">No execution logs</p>
        </div>
      ) : (
        Object.entries(state.node_execution_log).map(([node, log]) => (
          <Card key={node} padding="sm" hoverable>
            <div className="flex items-center justify-between">
              <span className={`text-white ${theme.fontWeight.medium}`}>{node}</span>
            </div>
            <pre className={`mt-3 text-sm text-slate-300 overflow-x-auto font-mono bg-slate-900/50 p-3 rounded border border-slate-700/50`}>
              {renderJSON(log)}
            </pre>
          </Card>
        ))
      )}
    </div>
  );

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'context', label: 'Context' },
    { id: 'messages', label: 'Messages', count: state.message_history?.length || 0 },
    { id: 'logs', label: 'Node Logs' },
  ];

  return (
    <Card>
      <div className="flex items-center gap-3 mb-5">
        <Icons.Chart className="text-blue-400 w-5 h-5" />
        <h3 className={`text-white ${theme.fontWeight.semibold}`}>State Inspector</h3>
      </div>

      {/* Tabs */}
      <div className={`flex gap-2 mb-5 bg-slate-900/30 p-1.5 rounded-lg ${theme.spacing.sm}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-md ${theme.fontWeight.medium} ${theme.transitions.normal} ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg'
                : `text-slate-400 hover:text-white hover:bg-slate-700/50`
            }`}
          >
            {tab.label}
            {tab.count !== undefined && ` (${tab.count})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'context' && renderContext()}
        {activeTab === 'messages' && renderMessages()}
        {activeTab === 'logs' && renderLogs()}
      </div>

      {/* Footer Info */}
      <div className={`mt-5 pt-4 border-t border-slate-700/50 text-xs text-slate-500 space-y-1`}>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Current Node:</span>
          <span className={`font-mono text-slate-300`}>{state.current_node}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Status:</span>
          <StatusBadge status={state.status} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Last Updated:</span>
          <span>{new Date(state.saved_at / 1000000).toLocaleString()}</span>
        </div>
      </div>
    </Card>
  );
}
