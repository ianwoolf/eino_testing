package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/cloudwego/eino/schema"
)

// UniversalState is the universal state structure that can save all context information
type UniversalState struct {
	MessageHistory   []*schema.Message `json:"message_history"`
	Context          map[string]any    `json:"context"`
	NodeExecutionLog map[string]any    `json:"node_execution_log"`
	SavedAt          int64             `json:"saved_at"`
}

type bookInput struct {
	Location             string `json:"location"`
	PassengerName        string `json:"passenger_name"`
	PassengerPhoneNumber string `json:"passenger_phone_number"`
}

func deepCopyState(s *UniversalState) *UniversalState {
	b, err := json.Marshal(s)
	if err != nil {
		log.Printf("failed to marshal state for deep copy: %v", err)
		return s
	}

	var ns UniversalState
	if err := json.Unmarshal(b, &ns); err != nil {
		log.Printf("failed to unmarshal state for deep copy: %v", err)
		return s
	}
	return &ns
}

func displayState(state *UniversalState) {
	fmt.Printf("\n=== Simulated Execution Interrupted ===\n")
	fmt.Printf("Saved at: %s\n\n", time.Unix(0, state.SavedAt).Format(time.RFC3339))

	fmt.Println("Current Context:")
	for k, v := range state.Context {
		fmt.Printf("  %s: %v\n", k, v)
	}

	fmt.Printf("\nMessage History (%d messages):\n", len(state.MessageHistory))
	for i, msg := range state.MessageHistory {
		fmt.Printf("  [%d] Role: %s\n", i, msg.Role)
		for j, tc := range msg.ToolCalls {
			fmt.Printf("      [%d] %s with args: %s\n", j, tc.Function.Name, tc.Function.Arguments)
		}
	}
}

func displayFullState(state *UniversalState) {
	fmt.Println("Current Context:")
	for key, value := range state.Context {
		fmt.Printf("  %s: %v\n", key, value)
	}

	fmt.Printf("\nMessage History (%d messages):\n", len(state.MessageHistory))
	for i, msg := range state.MessageHistory {
		fmt.Printf("  [%d] Role: %s\n", i, msg.Role)
		displayMessageContent(msg)
		displayToolCalls(msg)
	}
}

func displayMessageContent(msg *schema.Message) {
	if len(msg.Content) == 0 {
		return
	}
	if len(msg.Content) > 100 {
		fmt.Printf("      Content: %s...\n", msg.Content[:100])
	} else {
		fmt.Printf("      Content: %s\n", msg.Content)
	}
}

func displayToolCalls(msg *schema.Message) {
	if len(msg.ToolCalls) == 0 {
		return
	}
	fmt.Printf("      Tool calls: %d\n", len(msg.ToolCalls))
	for j, tc := range msg.ToolCalls {
		fmt.Printf("        [%d] %s with args: %s\n", j, tc.Function.Name, tc.Function.Arguments)
	}
}
