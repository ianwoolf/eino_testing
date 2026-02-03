package server

import (
	"time"

	"github.com/cloudwego/eino/schema"
	"eino_testing/hitl/pkg/types"
)

// ExecuteRequest is the input parameters for new execution
type ExecuteRequest struct {
	Name     string `json:"name"`
	Location string `json:"location"`
}

// ConfirmRequest is the tool call confirmation payload
type ConfirmRequest struct {
	ExecutionID string `json:"execution_id"`
	Action      string `json:"action"` // "confirm" or "reject"
	NewArgs     string `json:"new_args,omitempty"`
}

// StateResponse is the UniversalState API representation
type StateResponse struct {
	ExecutionID       string            `json:"execution_id"`
	Status            string            `json:"status"` // "running", "interrupted", "completed", "error"
	MessageHistory    []MessageResponse `json:"message_history"`
	Context           map[string]any    `json:"context"`
	NodeExecutionLog  map[string]any    `json:"node_execution_log"`
	SavedAt           int64             `json:"saved_at"`
	CurrentNode       string            `json:"current_node"`
	PendingToolCalls  []ToolCallResponse `json:"pending_tool_calls,omitempty"`
	Result            string            `json:"result,omitempty"`
	Error             string            `json:"error,omitempty"`
}

// MessageResponse is the API representation of a message
type MessageResponse struct {
	Role      string            `json:"role"`
	Content   string            `json:"content"`
	ToolCalls []ToolCallResponse `json:"tool_calls,omitempty"`
}

// ToolCallResponse is the API representation of a tool call
type ToolCallResponse struct {
	ID   string            `json:"id"`
	Name string            `json:"name"`
	Args string            `json:"args"`
}

// CheckpointSummary is the checkpoint metadata
type CheckpointSummary struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	Size      int64     `json:"size"`
}

// ExecutionInfo contains information about a running execution
type ExecutionInfo struct {
	ID           string              `json:"id"`
	Status       string              `json:"status"`
	CreatedAt    time.Time           `json:"created_at"`
	UpdatedAt    time.Time           `json:"updated_at"`
	CheckpointID string              `json:"checkpoint_id"`
	Input        map[string]any      `json:"input"`
}

// WebSocketEvent represents a real-time event sent to clients
type WebSocketEvent struct {
	Type      string        `json:"type"` // "state_update", "execution_started", "execution_completed", "error"
	Data      any           `json:"data"`
	Timestamp int64         `json:"timestamp"`
}

// APIError is a standard error response
type APIError struct {
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
	Details string `json:"details,omitempty"`
}

// Helper functions to convert between internal and API types

func messageToResponse(msg *schema.Message) MessageResponse {
	resp := MessageResponse{
		Role:    string(msg.Role),
		Content: msg.Content,
	}

	for _, tc := range msg.ToolCalls {
		resp.ToolCalls = append(resp.ToolCalls, ToolCallResponse{
			ID:   tc.ID,
			Name: tc.Function.Name,
			Args: tc.Function.Arguments,
		})
	}

	return resp
}

func stateToResponse(execID string, status, currentNode string, state *types.UniversalState, result string, errMsg string) StateResponse {
	resp := StateResponse{
		ExecutionID:      execID,
		Status:           status,
		Context:          state.Context,
		NodeExecutionLog: state.NodeExecutionLog,
		SavedAt:          state.SavedAt,
		CurrentNode:      currentNode,
		Result:           result,
		Error:            errMsg,
	}

	for _, msg := range state.MessageHistory {
		resp.MessageHistory = append(resp.MessageHistory, messageToResponse(msg))
	}

	// Extract pending tool calls from the last message if it's an assistant message with tool calls
	if len(state.MessageHistory) > 0 {
		lastMsg := state.MessageHistory[len(state.MessageHistory)-1]
		if lastMsg.Role == schema.Assistant && len(lastMsg.ToolCalls) > 0 {
			for _, tc := range lastMsg.ToolCalls {
				resp.PendingToolCalls = append(resp.PendingToolCalls, ToolCallResponse{
					ID:   tc.ID,
					Name: tc.Function.Name,
					Args: tc.Function.Arguments,
				})
			}
		}
	}

	return resp
}
