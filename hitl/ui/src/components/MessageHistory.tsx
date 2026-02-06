import { MessageResponse } from '../api/types';

interface MessageHistoryProps {
  messages: MessageResponse[];
}

export function MessageHistory({ messages }: MessageHistoryProps) {
  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'system':
        return 'bg-purple-900/30 border-purple-700/50';
      case 'user':
        return 'bg-blue-900/30 border-blue-700/50';
      case 'assistant':
        return 'bg-emerald-900/30 border-emerald-700/50';
      case 'tool':
        return 'bg-amber-900/30 border-amber-700/50';
      default:
        return 'bg-slate-700/30 border-slate-600/50';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'system':
        return '⚙️';
      case 'user':
        return '👤';
      case 'assistant':
        return '🤖';
      case 'tool':
        return '🔧';
      default:
        return '💬';
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-3 mb-5">
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <h3 className="text-white font-semibold">Message History</h3>
        <span className="text-slate-500 text-sm ml-auto">({messages?.length || 0} messages)</span>
      </div>

      {!messages || messages.length === 0 ? (
        <div className="text-slate-400 text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">No messages yet</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`${getRoleColor(msg.role)} border rounded-lg p-4 hover:border-opacity-70 transition-all`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{getRoleIcon(msg.role)}</span>
                <span className="text-white font-medium capitalize">{msg.role}</span>
                <span className="text-slate-500 text-xs ml-auto">Message {idx + 1}</span>
              </div>

              {msg.content && (
                <div className="text-slate-200 text-sm mb-3 whitespace-pre-wrap break-words leading-relaxed">
                  {msg.content}
                </div>
              )}

              {msg.tool_calls && msg.tool_calls.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-slate-400 text-xs uppercase tracking-wide font-medium">
                    Tool Calls ({msg.tool_calls.length})
                  </div>
                  {msg.tool_calls.map((tc, tcIdx) => (
                    <div key={tcIdx} className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-blue-300 font-medium text-sm flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {tc.name}
                        </span>
                        {tc.id && (
                          <span className="text-slate-500 text-xs font-mono bg-slate-800 px-2 py-0.5 rounded">
                            {tc.id.substring(0, 8)}...
                          </span>
                        )}
                      </div>
                      <pre className="text-slate-400 text-xs overflow-x-auto font-mono bg-slate-950/50 p-2 rounded">
                        {tc.args}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
