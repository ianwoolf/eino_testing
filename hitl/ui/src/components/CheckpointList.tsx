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
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <h3 className="text-white font-semibold">Checkpoints</h3>
        </div>
        <button
          onClick={loadCheckpoints}
          className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-600 transition-all flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-100 px-4 py-3 rounded-xl mb-5 flex items-center gap-2 backdrop-blur-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-slate-400 text-center py-12">
          <svg className="w-10 h-10 mx-auto mb-2 animate-spin opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-sm">Loading checkpoints...</p>
        </div>
      ) : !checkpoints || checkpoints.length === 0 ? (
        <div className="text-slate-400 text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-sm">No checkpoints found</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {checkpoints.map((checkpoint) => (
            <div
              key={checkpoint.id}
              className="bg-slate-700/50 border border-slate-600/50 rounded-lg p-4 hover:border-slate-500/50 transition-all flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">{checkpoint.id}</div>
                <div className="text-slate-400 text-xs mt-1 flex items-center gap-2">
                  <span>{new Date(checkpoint.created_at).toLocaleString()}</span>
                  <span className="text-slate-600">•</span>
                  <span>{formatSize(checkpoint.size)}</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(checkpoint.id)}
                disabled={deletingId === checkpoint.id}
                className="px-3 py-1.5 bg-red-600/80 text-white text-sm rounded-lg hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed transition-all ml-2"
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
