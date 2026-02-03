package types

import (
	"time"

	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
)

func init() {
	// Register UniversalState for serialization with compose framework
	_ = compose.RegisterSerializableType[*UniversalState]("universal_state")
}

// UniversalState is the universal state structure that can save all context information
type UniversalState struct {
	MessageHistory   []*schema.Message `json:"message_history"`
	Context          map[string]any    `json:"context"`
	NodeExecutionLog map[string]any    `json:"node_execution_log"`
	SavedAt          int64             `json:"saved_at"`
}

// NewUniversalState creates a new universal state
func NewUniversalState() *UniversalState {
	return &UniversalState{
		MessageHistory:   make([]*schema.Message, 0),
		Context:          make(map[string]any),
		NodeExecutionLog: make(map[string]any),
		SavedAt:          time.Now().UnixNano(),
	}
}
