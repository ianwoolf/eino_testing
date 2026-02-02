package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found: %v", err)
	}

	// Parse CLI flags
	flags := parseFlags()

	// Register universal state type
	_ = compose.RegisterSerializableType[*UniversalState]("universal_state")

	ctx := context.Background()

	// Create runner (skip in simulate mode to avoid external calls)
	var runner compose.Runnable[map[string]any, *schema.Message]
	var err error
	if !flags.simulate {
		runner, err = composeGraph[map[string]any, *schema.Message](
			ctx,
			newChatTemplate(ctx),
			newChatModel(ctx),
			newToolsNode(ctx),
			NewCheckPointStore(ctx, flags.baseDir),
		)
		if err != nil {
			log.Fatal(err)
		}
	}

	// Run the appropriate flow
	if flags.simulate {
		runSimulateFlow(flags)
	} else {
		runNormalFlow(ctx, runner, flags)
	}
}

type cliFlags struct {
	baseDir          string
	checkpointID     string
	exitAfterConfirm bool
	simulate         bool
}

func parseFlags() cliFlags {
	var f cliFlags
	flag.StringVar(&f.baseDir, "base-dir", defaultBaseDir, "directory to store checkpoints and overlays")
	flag.StringVar(&f.checkpointID, "checkpoint-id", defaultCheckpoint, "checkpoint id to use")
	flag.BoolVar(&f.exitAfterConfirm, "exit-after-confirm", false, "exit after saving confirmation overlay")
	flag.BoolVar(&f.simulate, "simulate", false, "run in simulate mode (no external model calls)")
	flag.Parse()
	return f
}

func runSimulateFlow(flags cliFlags) {
	// Check if pending overlay exists
	if st, err := loadPendingState(flags.baseDir, flags.checkpointID); err == nil && st != nil {
		fmt.Printf("Loaded pending overlay for checkpoint %s\n", flags.checkpointID)
		overlayPath := filepath.Join(flags.baseDir, flags.checkpointID+overlaySuffix)
		_ = os.Remove(overlayPath)
		fmt.Println("\nResuming execution (simulated, from overlay)...")
		fmt.Println("final result: Your ticket to Beijing has been successfully booked, Megumin!")
		return
	}

	// Create simulated state with pending tool call
	state := createSimulatedState()

	displayState(state)

	// Handle user confirmation
	if !handleUserConfirmation(flags.baseDir, flags.checkpointID, flags.exitAfterConfirm, state) {
		// User said no, updated and saved overlay
		return
	}

	// Simulate resume
	fmt.Println("\nResuming execution (simulated)...")
	fmt.Println("final result: Your ticket to Beijing has been successfully booked, Megumin!")
}

func runNormalFlow(ctx context.Context, runner compose.Runnable[map[string]any, *schema.Message], flags cliFlags) {
	input := map[string]any{
		"name":     "Megumin",
		"location": "Beijing",
	}

	var pendingState *UniversalState

	for {
		// Load pending state from overlay if exists
		if pendingState == nil {
			if st, err := loadPendingState(flags.baseDir, flags.checkpointID); err == nil && st != nil {
				pendingState = st
				log.Printf("loaded pending state overlay from disk")
			}
		}

		// Invoke runner with options
		opts := buildInvokeOptions(flags, pendingState)
		result, err := runner.Invoke(ctx, input, opts...)

		if err == nil {
			fmt.Printf("final result: %s\n", result.Content)
			return
		}

		// Extract interrupt info
		info, ok := compose.ExtractInterruptInfo(err)
		if !ok {
			log.Fatal(err)
		}

		state, ok := info.State.(*UniversalState)
		if !ok {
			log.Fatalf("unexpected state type: %T", info.State)
		}
		pendingState = nil

		// Display current state and handle tool calls
		displayFullState(state)
		handleToolCalls(flags, state)

		fmt.Println("\nResuming execution...")
	}
}

func buildInvokeOptions(flags cliFlags, pendingState *UniversalState) []compose.Option {
	opts := []compose.Option{compose.WithCheckPointID(flags.checkpointID)}

	if pendingState != nil {
		opts = append(opts, compose.WithStateModifier(func(ctx context.Context, path compose.NodePath, state any) error {
			if s, ok := state.(*UniversalState); ok {
				*s = *pendingState
				return nil
			}
			return fmt.Errorf("unexpected state type: %T", state)
		}))

		// Remove overlay file after loading
		overlayPath := filepath.Join(flags.baseDir, flags.checkpointID+overlaySuffix)
		if err := os.Remove(overlayPath); err != nil && !os.IsNotExist(err) {
			log.Printf("warning: failed to remove overlay file: %v", err)
		}
	}

	return opts
}

func createSimulatedState() *UniversalState {
	return &UniversalState{
		MessageHistory: []*schema.Message{
			{
				Role: schema.Assistant,
				ToolCalls: []schema.ToolCall{{
					Function: schema.FunctionCall{
						Name:      "BookTicket",
						Arguments: `{"location": "Beijing", "passenger_name": "Megumin", "passenger_phone_number": "1234567890"}`,
					},
				}},
			},
		},
		Context:          map[string]any{"name": "Megumin", "location": "Beijing"},
		NodeExecutionLog: map[string]any{},
		SavedAt:          time.Now().UnixNano(),
	}
}
