package checkpoint

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/cloudwego/eino/compose"
)

const (
	defaultBaseDir    = "./checkpoints_data"
	checkpointSuffix  = ".json"
)

// Store implements compose.CheckPointStore interface
type Store struct {
	baseDir string
}

// NewStore creates a new checkpoint store
func NewStore(baseDir string) *Store {
	if baseDir == "" {
		baseDir = defaultBaseDir
	}

	if err := os.MkdirAll(baseDir, 0755); err != nil {
		panic(fmt.Sprintf("Failed to create checkpoints directory: %v", err))
	}

	return &Store{baseDir: baseDir}
}

// Get retrieves checkpoint data by ID
func (s *Store) Get(ctx context.Context, checkPointID string) ([]byte, bool, error) {
	filePath := filepath.Join(s.baseDir, checkPointID+checkpointSuffix)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil, false, nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, false, fmt.Errorf("failed to read checkpoint file: %w", err)
	}

	return data, true, nil
}

// Set saves checkpoint data by ID
func (s *Store) Set(ctx context.Context, checkPointID string, checkPoint []byte) error {
	filePath := filepath.Join(s.baseDir, checkPointID+checkpointSuffix)

	tempFilePath := filePath + ".tmp"
	if err := os.WriteFile(tempFilePath, checkPoint, 0644); err != nil {
		return fmt.Errorf("failed to write checkpoint data: %w", err)
	}

	if err := os.Rename(tempFilePath, filePath); err != nil {
		_ = os.Remove(tempFilePath)
		return fmt.Errorf("failed to save checkpoint file: %w", err)
	}

	return nil
}

// GetBaseDir returns the base directory path
func (s *Store) GetBaseDir() string {
	return s.baseDir
}

// ToComposeStore converts to compose.CheckPointStore interface
func (s *Store) ToComposeStore() compose.CheckPointStore {
	return s
}