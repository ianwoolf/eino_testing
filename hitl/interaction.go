package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/cloudwego/eino/schema"
)

func handleUserConfirmation(baseDir, checkpointID string, exitAfterConfirm bool, state *UniversalState) bool {
	fmt.Print("Are the arguments as expected? (y/n): ")
	var resp string
	fmt.Scanln(&resp)

	if strings.ToLower(resp) != "n" {
		return true // User confirmed, proceed
	}

	// User wants to modify arguments
	fmt.Print("Please enter the modified arguments: ")
	scan := bufio.NewScanner(os.Stdin)
	if !scan.Scan() {
		return true
	}

	newArgs := scan.Text()
	state.MessageHistory[len(state.MessageHistory)-1].ToolCalls[0].Function.Arguments = newArgs

	if err := savePendingState(baseDir, checkpointID, state); err != nil {
		log.Printf("failed to save pending state overlay: %v", err)
	}

	if exitAfterConfirm {
		overlayPath := filepath.Join(baseDir, checkpointID+overlaySuffix)
		fmt.Printf("Saved confirmation overlay to %s and exiting (exit-after-confirm=true)\n", overlayPath)
		os.Exit(0)
	}

	return false // Arguments were modified
}

func handleToolCalls(flags cliFlags, state *UniversalState) {
	if len(state.MessageHistory) == 0 {
		return
	}

	lastMsg := state.MessageHistory[len(state.MessageHistory)-1]
	if len(lastMsg.ToolCalls) == 0 {
		return
	}

	for i, tc := range lastMsg.ToolCalls {
		fmt.Printf("\nTool Call [%d]: %s\n", i, tc.Function.Name)
		fmt.Printf("Arguments: %s\n", tc.Function.Arguments)
		fmt.Print("Are the arguments as expected? (y/n): ")

		var response string
		fmt.Scanln(&response)

		if strings.ToLower(response) == "n" {
			handleModifyArguments(flags, lastMsg, i)
		}

		// Save pending state for next resume
		pendingState := deepCopyState(state)
		if err := savePendingState(flags.baseDir, flags.checkpointID, pendingState); err != nil {
			log.Printf("failed to save pending state overlay: %v", err)
		}

		if flags.exitAfterConfirm {
			overlayPath := filepath.Join(flags.baseDir, flags.checkpointID+overlaySuffix)
			fmt.Printf("Saved confirmation overlay to %s and exiting (exit-after-confirm=true)\n", overlayPath)
			os.Exit(0)
		}
	}
}

func handleModifyArguments(flags cliFlags, lastMsg *schema.Message, idx int) {
	fmt.Print("Please enter the modified arguments: ")
	scanner := bufio.NewScanner(os.Stdin)
	if !scanner.Scan() {
		return
	}

	newArgs := scanner.Text()
	lastMsg.ToolCalls[idx].Function.Arguments = newArgs
	fmt.Printf("Updated arguments to: %s\n", newArgs)

	if err := updateCheckpointArguments(flags.baseDir, flags.checkpointID, newArgs); err != nil {
		log.Printf("failed to update checkpoint arguments on disk: %v", err)
	}
}
