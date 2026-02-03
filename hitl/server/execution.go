package server

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"eino_testing/hitl/pkg/types"
)

// ExecutionManager manages concurrent executions
type ExecutionManager struct {
	mu         sync.RWMutex
	executions map[string]*Execution
	nextID     int
}

// Execution represents a single execution instance
type Execution struct {
	ID         string         `json:"id"`
	Status     string         `json:"status"` // "running", "interrupted", "completed", "error"
	CheckpointID string        `json:"checkpoint_id"`
	Input      map[string]any `json:"input"`
	Result     string         `json:"result,omitempty"`
	Error      string         `json:"error,omitempty"`
	State      *types.UniversalState `json:"state,omitempty"`
	CurrentNode string        `json:"current_node"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	Runner     compose.Runnable[map[string]any, *schema.Message] `json:"-"`
	CancelFunc context.CancelFunc `json:"-"`
}

// NewExecutionManager creates a new execution manager
func NewExecutionManager() *ExecutionManager {
	return &ExecutionManager{
		executions: make(map[string]*Execution),
		nextID:     1,
	}
}

// CreateExecution creates a new execution instance
func (em *ExecutionManager) CreateExecution(
	ctx context.Context,
	runner compose.Runnable[map[string]any, *schema.Message],
	checkpointID string,
	input map[string]any,
) *Execution {
	em.mu.Lock()
	defer em.mu.Unlock()

	id := fmt.Sprintf("exec-%d", em.nextID)
	em.nextID++

	exec := &Execution{
		ID:          id,
		Status:      "running",
		CheckpointID: checkpointID,
		Input:       input,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		Runner:      runner,
		CurrentNode: "ChatTemplate",
	}

	em.executions[id] = exec
	return exec
}

// GetExecution retrieves an execution by ID
func (em *ExecutionManager) GetExecution(id string) (*Execution, bool) {
	em.mu.RLock()
	defer em.mu.RUnlock()

	exec, ok := em.executions[id]
	return exec, ok
}

// UpdateExecutionState updates the execution state
func (em *ExecutionManager) UpdateExecutionState(id, status, currentNode string, state *types.UniversalState) {
	em.mu.Lock()
	defer em.mu.Unlock()

	if exec, ok := em.executions[id]; ok {
		exec.Status = status
		exec.State = state
		exec.CurrentNode = currentNode
		exec.UpdatedAt = time.Now()
	}
}

// CompleteExecution marks an execution as completed
func (em *ExecutionManager) CompleteExecution(id, result string) {
	em.mu.Lock()
	defer em.mu.Unlock()

	if exec, ok := em.executions[id]; ok {
		exec.Status = "completed"
		exec.Result = result
		exec.UpdatedAt = time.Now()
	}
}

// ErrorExecution marks an execution as errored
func (em *ExecutionManager) ErrorExecution(id, errMsg string) {
	em.mu.Lock()
	defer em.mu.Unlock()

	if exec, ok := em.executions[id]; ok {
		exec.Status = "error"
		exec.Error = errMsg
		exec.UpdatedAt = time.Now()
	}
}

// UpdateToolCalls updates the tool calls in the execution state
func (em *ExecutionManager) UpdateToolCalls(id string, newArgs string) error {
	em.mu.Lock()
	defer em.mu.Unlock()

	exec, ok := em.executions[id]
	if !ok {
		return fmt.Errorf("execution not found: %s", id)
	}

	if exec.State == nil || len(exec.State.MessageHistory) == 0 {
		return fmt.Errorf("no state or message history")
	}

	lastMsg := exec.State.MessageHistory[len(exec.State.MessageHistory)-1]
	if len(lastMsg.ToolCalls) == 0 {
		return fmt.Errorf("no tool calls to update")
	}

	// Update the first tool call's arguments
	lastMsg.ToolCalls[0].Function.Arguments = newArgs
	exec.UpdatedAt = time.Now()

	return nil
}

// ListExecutions returns all executions
func (em *ExecutionManager) ListExecutions() []*Execution {
	em.mu.RLock()
	defer em.mu.RUnlock()

	executions := make([]*Execution, 0, len(em.executions))
	for _, exec := range em.executions {
		executions = append(executions, exec)
	}
	return executions
}

// DeleteExecution removes an execution
func (em *ExecutionManager) DeleteExecution(id string) {
	em.mu.Lock()
	defer em.mu.Unlock()

	delete(em.executions, id)
}

// BroadcastStateChange broadcasts a state change to all connected WebSocket clients
func (em *ExecutionManager) BroadcastStateChange(hub *WSHub, execID string) {
	exec, ok := em.GetExecution(execID)
	if !ok {
		return
	}

	event := WebSocketEvent{
		Type:      "state_update",
		Data:      exec,
		Timestamp: time.Now().UnixNano(),
	}

	hub.Broadcast(execID, event)
}

// BroadcastExecutionStarted broadcasts an execution started event
func (em *ExecutionManager) BroadcastExecutionStarted(hub *WSHub, exec *Execution) {
	event := WebSocketEvent{
		Type:      "execution_started",
		Data:      exec,
		Timestamp: time.Now().UnixNano(),
	}

	hub.Broadcast(exec.ID, event)
}

// BroadcastExecutionCompleted broadcasts an execution completed event
func (em *ExecutionManager) BroadcastExecutionCompleted(hub *WSHub, execID string) {
	exec, ok := em.GetExecution(execID)
	if !ok {
		return
	}

	event := WebSocketEvent{
		Type:      "execution_completed",
		Data:      exec,
		Timestamp: time.Now().UnixNano(),
	}

	hub.Broadcast(execID, event)
}

// BroadcastError broadcasts an error event
func (em *ExecutionManager) BroadcastError(hub *WSHub, execID, errMsg string) {
	event := WebSocketEvent{
		Type:      "error",
		Data:      map[string]string{"execution_id": execID, "error": errMsg},
		Timestamp: time.Now().UnixNano(),
	}

	hub.Broadcast(execID, event)
}

// RunExecution runs the execution asynchronously
func (em *ExecutionManager) RunExecution(
	ctx context.Context,
	exec *Execution,
	hub *WSHub,
	baseDir string,
) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				errMsg := fmt.Sprintf("Execution panic: %v", r)
				log.Printf("[Execution %s] %s", exec.ID, errMsg)
				em.ErrorExecution(exec.ID, errMsg)
				em.BroadcastError(hub, exec.ID, errMsg)
			}
		}()

		em.BroadcastExecutionStarted(hub, exec)

		opts := buildWebInvokeOptions(exec, baseDir)

		result, err := exec.Runner.Invoke(ctx, exec.Input, opts...)
		if err == nil {
			em.CompleteExecution(exec.ID, result.Content)
			em.BroadcastExecutionCompleted(hub, exec.ID)
			log.Printf("[Execution %s] Completed with result: %s", exec.ID, result.Content)
			return
		}

		// Extract interrupt info
		info, ok := compose.ExtractInterruptInfo(err)
		if !ok {
			errMsg := fmt.Sprintf("Execution error: %v", err)
			log.Printf("[Execution %s] %s", exec.ID, errMsg)
			em.ErrorExecution(exec.ID, errMsg)
			em.BroadcastError(hub, exec.ID, errMsg)
			return
		}

		state, ok := info.State.(*types.UniversalState)
		if !ok {
			errMsg := fmt.Sprintf("Unexpected state type: %T", info.State)
			log.Printf("[Execution %s] %s", exec.ID, errMsg)
			em.ErrorExecution(exec.ID, errMsg)
			em.BroadcastError(hub, exec.ID, errMsg)
			return
		}

		em.UpdateExecutionState(exec.ID, "interrupted", "ToolsNode", state)
		em.BroadcastStateChange(hub, exec.ID)
		log.Printf("[Execution %s] Interrupted at ToolsNode", exec.ID)
	}()
}

// buildWebInvokeOptions builds invoke options for web mode
func buildWebInvokeOptions(exec *Execution, baseDir string) []compose.Option {
	return []compose.Option{
		compose.WithCheckPointID(exec.CheckpointID),
	}
}
