import { useState, useEffect } from 'react';
import { ToolCallResponse } from '../api/types';
import { apiClient } from '../api/client';

interface ToolCallConfirmProps {
  executionId: string;
  toolCalls: ToolCallResponse[];
  onConfirmed: () => void;
  onRejected: () => void;
}

export function ToolCallConfirm({ executionId, toolCalls, onConfirmed, onRejected }: ToolCallConfirmProps) {
  const [editingStates, setEditingStates] = useState<{
    [key: number]: {
      isEditing: boolean;
      editedArgs: string;
      originalArgs: string;
    }
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleConfirm = async (index: number) => {
    setIsLoading(true);
    setError(null);

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

  const startEditing = (index: number) => {
    setEditingStates(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        isEditing: true,
      },
    }));
  };

  const cancelEditing = (index: number) => {
    setEditingStates(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        isEditing: false,
        editedArgs: prev[index].originalArgs,
      },
    }));
  };

  const updateArgs = (index: number, newArgs: string) => {
    setEditingStates(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        editedArgs: newArgs,
      },
    }));
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
          {toolCalls.map((toolCall, index) => {
            const state = editingStates[index];
            const isCurrentlyEditing = state?.isEditing || false;
            const currentArgs = state?.editedArgs || toolCall.args;
            const hasChangesMade = hasChanges(index);
            const isCurrentValid = isValid(index);

            return (
              <div key={toolCall.id || index} className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium">{toolCall.name}</h4>
                  <span className="text-xs text-gray-400">ID: {toolCall.id}</span>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-300 text-sm mb-2">
                    {isCurrentlyEditing ? 'Edited Arguments:' : 'Arguments:'}
                  </label>

                  {isCurrentlyEditing ? (
                    <>
                      <textarea
                        value={currentArgs}
                        onChange={(e) => updateArgs(index, e.target.value)}
                        className="w-full h-40 bg-gray-900 text-gray-100 font-mono text-sm p-3 rounded border border-yellow-500 focus:border-blue-500 focus:outline-none"
                        spellCheck={false}
                      />
                      {!isCurrentValid && (
                        <p className="text-red-400 text-sm mt-1">Invalid JSON format</p>
                      )}
                      {hasChangesMade && isCurrentValid && (
                        <p className="text-yellow-400 text-sm mt-1">
                          Modified from original
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <pre className="bg-gray-900 text-gray-100 font-mono text-sm p-3 rounded overflow-x-auto">
                        {formatJSON(currentArgs)}
                      </pre>
                      {hasChangesMade && (
                        <p className="text-yellow-400 text-sm mt-1">
                          Modified (not yet submitted)
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  {isCurrentlyEditing ? (
                    <>
                      <button
                        onClick={() => handleConfirm(index)}
                        disabled={isLoading || !isCurrentValid}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                      >
                        {isLoading ? 'Submitting...' : (hasChangesMade ? 'Submit Modified' : 'Confirm')}
                      </button>
                      <button
                        onClick={() => cancelEditing(index)}
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
                        onClick={() => startEditing(index)}
                        disabled={isLoading}
                        className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:bg-gray-600"
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
