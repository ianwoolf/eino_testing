import { useEffect, useState } from 'react';
import { CheckpointSummary } from '../api/types';
import { apiClient } from '../api/client';

export function CheckpointList() {
  const [checkpoints, setCheckpoints] = useState<CheckpointSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCheckpoints = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.listCheckpoints();
      setCheckpoints(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load checkpoints');
      setCheckpoints([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete checkpoint ${id}?`)) return;

    setDeletingId(id);
    try {
      await apiClient.deleteCheckpoint(id);
      setCheckpoints((prev) => (prev || []).filter((cp) => cp.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete checkpoint');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    loadCheckpoints();
    const interval = setInterval(loadCheckpoints, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Checkpoints</h3>
        <button
          onClick={loadCheckpoints}
          className="px-3 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-600"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-400 text-center py-8">Loading checkpoints...</div>
      ) : !checkpoints || checkpoints.length === 0 ? (
        <div className="text-gray-400 text-center py-8">No checkpoints found</div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {checkpoints.map((checkpoint) => (
            <div
              key={checkpoint.id}
              className="bg-gray-700 rounded p-3 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="text-white font-medium">{checkpoint.id}</div>
                <div className="text-gray-400 text-xs">
                  {new Date(checkpoint.created_at).toLocaleString()} • {formatSize(checkpoint.size)}
                </div>
              </div>
              <button
                onClick={() => handleDelete(checkpoint.id)}
                disabled={deletingId === checkpoint.id}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-gray-600"
              >
                {deletingId === checkpoint.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
