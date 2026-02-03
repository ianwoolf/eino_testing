package server

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"eino_testing/hitl/pkg/types"
)

const (
	overlaySuffix    = ".confirm.json"
	checkpointSuffix = ".json"
)

func savePendingState(baseDir, checkpointID string, s *types.UniversalState) error {
	path := filepath.Join(baseDir, checkpointID+overlaySuffix)
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal pending state: %w", err)
	}

	return atomicWriteFile(path, b)
}

func loadPendingState(baseDir, checkpointID string) (*types.UniversalState, error) {
	path := filepath.Join(baseDir, checkpointID+overlaySuffix)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil, fmt.Errorf("pending state overlay not found")
	}

	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read pending state: %w", err)
	}

	var s types.UniversalState
	if err := json.Unmarshal(b, &s); err != nil {
		return nil, fmt.Errorf("unmarshal pending state: %w", err)
	}
	return &s, nil
}

func updateCheckpointArguments(baseDir, checkpointID, newArgs string) error {
	path := filepath.Join(baseDir, checkpointID+checkpointSuffix)

	root, err := readCheckpointJSON(path)
	if err != nil {
		return err
	}

	if err := updateLastToolCallArguments(root, newArgs); err != nil {
		return err
	}

	b, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal checkpoint json: %w", err)
	}

	return atomicWriteFile(path, b)
}

func readCheckpointJSON(path string) (map[string]any, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read checkpoint file: %w", err)
	}

	var root map[string]any
	if err := json.Unmarshal(b, &root); err != nil {
		return nil, fmt.Errorf("unmarshal checkpoint json: %w", err)
	}
	return root, nil
}

func updateLastToolCallArguments(root map[string]any, newArgs string) error {
	getMap := func(m map[string]any, key string) (map[string]any, error) {
		v, ok := m[key]
		if !ok {
			return nil, fmt.Errorf("invalid checkpoint format: %s missing", key)
		}
		mm, ok := v.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("invalid checkpoint format: %s is not an object", key)
		}
		return mm, nil
	}

	getSlice := func(m map[string]any, key string) ([]any, error) {
		v, ok := m[key]
		if !ok {
			return nil, fmt.Errorf("invalid checkpoint format: %s missing", key)
		}
		s, ok := v.([]any)
		if !ok {
			return nil, fmt.Errorf("invalid checkpoint format: %s is not a slice", key)
		}
		return s, nil
	}

	mv, err := getMap(root, "MapValues")
	if err != nil {
		return err
	}
	state, err := getMap(mv, "State")
	if err != nil {
		return err
	}
	sv, err := getMap(state, "MapValues")
	if err != nil {
		return err
	}
	mh, err := getMap(sv, "MessageHistory")
	if err != nil {
		return err
	}

	slice, err := getSlice(mh, "SliceValues")
	if err != nil || len(slice) == 0 {
		return fmt.Errorf("no messages in message history")
	}

	for i := len(slice) - 1; i >= 0; i-- {
		if updateToolCallInMessage(slice[i], newArgs) {
			return nil
		}
	}

	return fmt.Errorf("no tool call found to update")
}

func updateToolCallInMessage(msg any, newArgs string) bool {
	msgMap, ok := msg.(map[string]any)
	if !ok {
		return false
	}

	mapvals, ok := msgMap["MapValues"].(map[string]any)
	if !ok {
		return false
	}

	toolCalls, ok := mapvals["ToolCalls"].(map[string]any)
	if !ok {
		return false
	}

	sv2, ok := toolCalls["SliceValues"].([]any)
	if !ok || len(sv2) == 0 {
		return false
	}

	for j := len(sv2) - 1; j >= 0; j-- {
		first, ok := sv2[j].(map[string]any)
		if !ok {
			continue
		}

		fmap, ok := first["MapValues"].(map[string]any)
		if !ok {
			continue
		}

		function, ok := fmap["Function"].(map[string]any)
		if !ok {
			continue
		}

		fmap2, ok := function["MapValues"].(map[string]any)
		if !ok {
			continue
		}

		arguments, ok := fmap2["Arguments"].(map[string]any)
		if !ok {
			continue
		}

		arguments["JSONValue"] = newArgs
		return true
	}

	return false
}

func atomicWriteFile(path string, data []byte) error {
	temp := path + ".tmp"
	if err := os.WriteFile(temp, data, 0644); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}
	if err := os.Rename(temp, path); err != nil {
		_ = os.Remove(temp)
		return fmt.Errorf("rename temp file: %w", err)
	}
	return nil
}
