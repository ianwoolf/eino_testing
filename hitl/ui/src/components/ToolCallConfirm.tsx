import { useState } from 'react';
import { ToolCallResponse } from '../api/types';
import { apiClient } from '../api/client';

interface ToolCallConfirmProps {
  executionId: string;
  toolCalls: ToolCallResponse[];
  onConfirmed: () => void;
  onRejected: () => void;
}

export function ToolCallConfirm({ executionId, toolCalls, onConfirmed, onRejected }: ToolCallConfirmProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedArgs, setEditedArgs] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (index: number) => {
    setIsLoading(true);
    setError(null);

    try {
      if (editingIndex === index && editedArgs) {
        // Reject with new arguments
        await apiClient.confirm({
          execution_id: executionId,
          action: 'reject',
          new_args: editedArgs,
        });
      } else {
        // Confirm as-is
        await apiClient.confirm({
          execution_id: executionId,
          action: 'confirm',
        });
      }

      if (editingIndex === index) {
        onRejected();
      } else {
        onConfirmed();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit confirmation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (index: number, args: string) => {
    setEditingIndex(index);
    setEditedArgs(args);
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

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-white font-semibold mb-4">Pending Tool Calls</h3>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}

      {!toolCalls || toolCalls.length === 0 ? (
        <p className="text-gray-400">No pending tool calls</p>
      ) : (
        <div className="space-y-4">
          {toolCalls.map((toolCall, index) => (
            <div key={toolCall.id || index} className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-medium">{toolCall.name}</h4>
                <span className="text-xs text-gray-400">ID: {toolCall.id}</span>
              </div>

              <div className="mb-4">
                <label className="block text-gray-300 text-sm mb-2">Arguments:</label>
                {editingIndex === index ? (
                  <textarea
                    value={editedArgs}
                    onChange={(e) => setEditedArgs(e.target.value)}
                    className="w-full h-40 bg-gray-900 text-gray-100 font-mono text-sm p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    spellCheck={false}
                  />
                ) : (
                  <pre className="bg-gray-900 text-gray-100 font-mono text-sm p-3 rounded overflow-x-auto">
                    {formatJSON(toolCall.args)}
                  </pre>
                )}
                {!validateJSON(editingIndex === index ? editedArgs : toolCall.args) && (
                  <p className="text-red-400 text-sm mt-1">Invalid JSON</p>
                )}
              </div>

              <div className="flex gap-2">
                {editingIndex === index ? (
                  <>
                    <button
                      onClick={() => handleConfirm(index)}
                      disabled={isLoading || !validateJSON(editedArgs)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Submitting...' : 'Submit Modified'}
                    </button>
                    <button
                      onClick={() => setEditingIndex(null)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleConfirm(index)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Confirming...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => handleEdit(index, toolCall.args)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:bg-gray-600"
                    >
                      Edit & Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
