import { MessageResponse } from '../api/types';

interface MessageHistoryProps {
  messages: MessageResponse[];
}

export function MessageHistory({ messages }: MessageHistoryProps) {
  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'system':
        return 'bg-purple-900 border-purple-700';
      case 'user':
        return 'bg-blue-900 border-blue-700';
      case 'assistant':
        return 'bg-green-900 border-green-700';
      case 'tool':
        return 'bg-yellow-900 border-yellow-700';
      default:
        return 'bg-gray-700 border-gray-600';
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
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-white font-semibold mb-4">Message History</h3>

      {!messages || messages.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No messages yet</p>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`${getRoleColor(msg.role)} border rounded-lg p-3`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{getRoleIcon(msg.role)}</span>
                <span className="text-white font-medium capitalize">{msg.role}</span>
                <span className="text-gray-400 text-xs">Message {idx + 1}</span>
              </div>

              {msg.content && (
                <div className="text-gray-200 text-sm mb-2 whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
              )}

              {msg.tool_calls && msg.tool_calls.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="text-gray-400 text-xs uppercase tracking-wide">
                    Tool Calls ({msg.tool_calls.length})
                  </div>
                  {msg.tool_calls.map((tc, tcIdx) => (
                    <div key={tcIdx} className="bg-black bg-opacity-30 rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-blue-300 font-medium text-sm">
                          📞 {tc.name}
                        </span>
                        {tc.id && (
                          <span className="text-gray-500 text-xs font-mono">
                            {tc.id.substring(0, 8)}...
                          </span>
                        )}
                      </div>
                      <pre className="text-gray-400 text-xs overflow-x-auto font-mono">
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
