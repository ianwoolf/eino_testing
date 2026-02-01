package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/cloudwego/eino/compose"
)

type myStore struct {
	baseDir string
}

func NewCheckPointStore(ctx context.Context, baseDir string) compose.CheckPointStore {
	if baseDir == "" {
		baseDir = "./checkpoints"
	}

	if err := os.MkdirAll(baseDir, 0755); err != nil {
		log.Fatalf("Failed to create checkpoints directory: %v", err)
	}

	return &myStore{baseDir: baseDir}
}

func (m *myStore) Get(ctx context.Context, checkPointID string) ([]byte, bool, error) {
	filePath := filepath.Join(m.baseDir, checkPointID+".json")

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil, false, nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, false, fmt.Errorf("failed to read checkpoint file: %w", err)
	}

	return data, true, nil
}

func (m *myStore) Set(ctx context.Context, checkPointID string, checkPoint []byte) error {
	filePath := filepath.Join(m.baseDir, checkPointID+".json")

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
