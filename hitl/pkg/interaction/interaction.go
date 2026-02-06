package interaction

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/cloudwego/eino/schema"
	"eino_testing/hitl/pkg/types"
)

// HandleUserConfirmation handles user confirmation for tool call arguments
func HandleUserConfirmation(state *types.UniversalState) (bool, error) {
	fmt.Print("Are the arguments as expected? (y/n): ")
	var resp string
	fmt.Scanln(&resp)

	if strings.ToLower(resp) != "n" {
		return true, nil
	}

	fmt.Print("Please enter the modified arguments: ")
	scan := bufio.NewScanner(os.Stdin)
	if !scan.Scan() {
		return true, nil
	}

	newArgs := scan.Text()
	if len(state.MessageHistory) > 0 {
		lastMsg := state.MessageHistory[len(state.MessageHistory)-1]
		if len(lastMsg.ToolCalls) > 0 {
			lastMsg.ToolCalls[0].Function.Arguments = newArgs
		}
	}

	return false, nil
}

// HandleToolCalls handles tool call confirmations for all pending tool calls
func HandleToolCalls(state *types.UniversalState) error {
	if len(state.MessageHistory) == 0 {
		return nil
	}

	lastMsg := state.MessageHistory[len(state.MessageHistory)-1]
	if len(lastMsg.ToolCalls) == 0 {
		return nil
	}

	for i, tc := range lastMsg.ToolCalls {
		fmt.Printf("\nTool Call [%d]: %s\n", i, tc.Function.Name)
		fmt.Printf("Arguments: %s\n", tc.Function.Arguments)
		fmt.Print("Are the arguments as expected? (y/n): ")

		var response string
		fmt.Scanln(&response)

		if strings.ToLower(response) == "n" {
			if err := handleModifyArguments(lastMsg, i); err != nil {
				return err
			}
		}
	}

	return nil
}

// handleModifyArguments handles modifying tool call arguments
func handleModifyArguments(lastMsg *schema.Message, idx int) error {
	fmt.Print("Please enter the modified arguments: ")
	scanner := bufio.NewScanner(os.Stdin)
	if !scanner.Scan() {
		return nil
	}

	newArgs := scanner.Text()
	lastMsg.ToolCalls[idx].Function.Arguments = newArgs
	fmt.Printf("Updated arguments to: %s\n", newArgs)
	return nil
}

// DisplayState displays the current state information
func DisplayState(state *types.UniversalState) {
	fmt.Printf("\n=== Current State ===\n")

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

// displayMessageContent displays message content
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

// displayToolCalls displays tool calls in a message
func displayToolCalls(msg *schema.Message) {
	if len(msg.ToolCalls) == 0 {
		return
	}
	fmt.Printf("      Tool calls: %d\n", len(msg.ToolCalls))
	for j, tc := range msg.ToolCalls {
		fmt.Printf("        [%d] %s with args: %s\n", j, tc.Function.Name, tc.Function.Arguments)
	}
}