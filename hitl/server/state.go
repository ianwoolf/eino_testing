package server

import (
	"eino_testing/hitl/pkg/checkpoint"
	"eino_testing/hitl/pkg/types"
)

// savePendingState 保存待处理状态（使用新的checkpoint包）
func savePendingState(baseDir, checkpointID string, s *types.UniversalState) error {
	return checkpoint.SavePendingState(baseDir, checkpointID, s)
}

// loadPendingState 加载待处理状态（使用新的checkpoint包）
func loadPendingState(baseDir, checkpointID string) (*types.UniversalState, error) {
	return checkpoint.LoadPendingState(baseDir, checkpointID)
}

// updateCheckpointArguments 更新检查点参数（使用新的checkpoint包）
func updateCheckpointArguments(baseDir, checkpointID, newArgs string) error {
	return checkpoint.UpdateCheckpointArguments(baseDir, checkpointID, newArgs)
}

// removePendingState 移除待处理状态（使用新的checkpoint包）
func removePendingState(baseDir, checkpointID string) error {
	return checkpoint.RemovePendingState(baseDir, checkpointID)
}

// hasPendingState 检查是否有待处理状态（使用新的checkpoint包）
func hasPendingState(baseDir, checkpointID string) bool {
	return checkpoint.HasPendingState(baseDir, checkpointID)
}
