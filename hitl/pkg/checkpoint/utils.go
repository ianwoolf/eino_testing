package checkpoint

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// CheckpointSummary represents checkpoint metadata
type CheckpointSummary struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	Size      int64     `json:"size"`
}

// ListCheckpoints lists all checkpoints in the base directory
func ListCheckpoints(baseDir string) ([]CheckpointSummary, error) {
	var checkpoints []CheckpointSummary

	files, err := os.ReadDir(baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			return checkpoints, nil
		}
		return nil, err
	}

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		name := file.Name()
		if filepath.Ext(name) == checkpointSuffix && !hasOverlaySuffix(name) {
			info, _ := file.Info()
			checkpointID := name[:len(name)-len(checkpointSuffix)]
			checkpoints = append(checkpoints, CheckpointSummary{
				ID:        checkpointID,
				CreatedAt: info.ModTime(),
				Size:      info.Size(),
			})
		}
	}

	return checkpoints, nil
}

// DeleteCheckpoint deletes a checkpoint and its overlay
func DeleteCheckpoint(baseDir, id string) error {
	// Delete checkpoint file
	checkpointPath := filepath.Join(baseDir, id+checkpointSuffix)
	if err := os.Remove(checkpointPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete checkpoint file: %w", err)
	}

	// Delete overlay file if exists
	overlayPath := filepath.Join(baseDir, id+overlaySuffix)
	if err := os.Remove(overlayPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete overlay file: %w", err)
	}

	return nil
}

// hasOverlaySuffix checks if a filename has the overlay suffix
func hasOverlaySuffix(name string) bool {
	baseName := filepath.Base(name)
	return len(baseName) > len(overlaySuffix) && baseName[len(baseName)-len(overlaySuffix):] == overlaySuffix
}