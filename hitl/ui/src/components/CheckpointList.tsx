import { useEffect, useState } from 'react';
import { CheckpointSummary } from '../api/types';
import { apiClient } from '../api/client';
import { Button, Card, Icons } from './ui';
import { theme } from '../theme';

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
      setCheckpoints([]);
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
    <Card>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Icons.Box className="text-purple-400 w-5 h-5" />
          <h3 className={`text-white ${theme.fontWeight.semibold}`}>Checkpoints</h3>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadCheckpoints}
        >
          <div className="flex items-center gap-1.5">
            <Icons.Refresh className="w-4 h-4" />
            Refresh
          </div>
        </Button>
      </div>

      {error && (
        <Card padding="md" className="mb-5 border-red-700/50 bg-red-900/30">
          <div className="flex items-center gap-2 text-red-100">
            <Icons.Alert className="w-5 h-5" />
            {error}
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className={`text-slate-400 text-center py-12`}>
          <Icons.Loading className="mx-auto w-6 h-6" />
          <p className="text-sm mt-2">Loading checkpoints...</p>
        </div>
      ) : !checkpoints || checkpoints.length === 0 ? (
        <div className={`text-slate-400 text-center py-12`}>
          <Icons.Box className="mx-auto mb-3 opacity-30 w-6 h-6" />
          <p className="text-sm">No checkpoints found</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {checkpoints.map((checkpoint) => (
            <Card key={checkpoint.id} padding="sm" hoverable>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className={`text-white ${theme.fontWeight.medium} truncate`}>
                    {checkpoint.id}
                  </div>
                  <div className={`text-slate-400 text-xs mt-1 flex items-center gap-2`}>
                    <span>{new Date(checkpoint.created_at).toLocaleString()}</span>
                    <span className="text-slate-500">•</span>
                    <span>{formatSize(checkpoint.size)}</span>
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(checkpoint.id)}
                  loading={deletingId === checkpoint.id}
                  className="ml-2"
                >
                  <div className="flex items-center gap-1">
                    <Icons.Trash className="w-4 h-4" />
                    {deletingId === checkpoint.id ? 'Deleting...' : 'Delete'}
                  </div>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
}
