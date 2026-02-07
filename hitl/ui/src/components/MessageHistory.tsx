import { MessageResponse } from '../api/types';
import { Card, Icons, StatusIndicator } from './ui';
import { theme } from '../theme';

interface MessageHistoryProps {
  messages: MessageResponse[];
}

export function MessageHistory({ messages }: MessageHistoryProps) {
  const getRoleStyles = (role: string) => {
    const roleLower = role.toLowerCase();
    const statusMap: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
      system: 'neutral',
      user: 'info',
      assistant: 'success',
      tool: 'warning',
    };
    return statusMap[roleLower] || 'neutral';
  };

  const getRoleIcon = (role: string) => {
    const roleLower = role.toLowerCase();
    const iconMap: Record<string, keyof typeof Icons> = {
      system: 'Alert',
      user: 'Info',
      assistant: 'Check',
      tool: 'Edit',
    };
    return iconMap[roleLower] || 'Message';
  };

  return (
    <Card>
      <div className="flex items-center gap-3 mb-5">
        <Icons.Message className="text-blue-400 w-5 h-5" />
        <h3 className={`text-white ${theme.fontWeight.semibold}`}>Message History</h3>
        <span className={'text-slate-500 text-sm ml-auto'}>({messages?.length || 0} messages)</span>
      </div>

      {!messages || messages.length === 0 ? (
        <div className={`text-slate-400 text-center py-12`}>
          <Icons.Message className="mx-auto mb-3 opacity-30 w-6 h-6" />
          <p className="text-sm">No messages yet</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {messages.map((msg, idx) => {
            const roleStatus = getRoleStyles(msg.role);
            const RoleIcon = Icons[getRoleIcon(msg.role)];

            return (
              <Card key={idx} padding="md" className={`border ${getStatusBorder(roleStatus)}`}>
                <div className="flex items-center gap-2 mb-3">
                  <RoleIcon className={getStatusColor(roleStatus) + ' w-4 h-4'} />
                  <span className={`text-white ${theme.fontWeight.medium} capitalize`}>
                    {msg.role}
                  </span>
                  <StatusIndicator status={roleStatus} size="sm" />
                  <span className={'text-slate-500 text-xs ml-auto'}>Message {idx + 1}</span>
                </div>

                {msg.content && (
                  <div className={`text-slate-300 text-sm mb-3 whitespace-pre-wrap break-words leading-relaxed`}>
                    {msg.content}
                  </div>
                )}

                {msg.tool_calls && msg.tool_calls.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className={`text-slate-400 text-xs uppercase tracking-wide ${theme.fontWeight.medium}`}>
                      Tool Calls ({msg.tool_calls.length})
                    </div>
                    {msg.tool_calls.map((tc, tcIdx) => (
                      <Card key={tcIdx} padding="sm" className="bg-slate-900/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-blue-300 font-medium text-sm flex items-center gap-1.5">
                            <Icons.Edit className="w-4 h-4" />
                            {tc.name}
                          </span>
                          {tc.id && (
                            <span className={`text-slate-500 text-xs font-mono bg-slate-800 px-2 py-0.5 rounded`}>
                              {tc.id.substring(0, 8)}...
                            </span>
                          )}
                        </div>
                        <pre className={`text-slate-400 text-xs overflow-x-auto font-mono bg-slate-950/50 p-2 rounded`}>
                          {tc.args}
                        </pre>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// Helper functions
const getStatusBorder = (status: string): string => {
  const borders: Record<string, string> = {
    neutral: 'border-purple-700/50',
    info: 'border-blue-700/50',
    success: 'border-emerald-700/50',
    warning: 'border-amber-700/50',
  };
  return borders[status] || borders.neutral;
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    neutral: 'text-purple-400',
    info: 'text-blue-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
  };
  return colors[status] || colors.neutral;
};
