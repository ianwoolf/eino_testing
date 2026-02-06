package examples

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/prompt"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"eino_testing/hitl/pkg/checkpoint"
	"eino_testing/hitl/pkg/graph"
	"eino_testing/hitl/pkg/interaction"
	"eino_testing/hitl/pkg/types"
)

// BasicExample demonstrates basic usage of the HITL package
func BasicExample() {
	ctx := context.Background()

	// 1. Create checkpoint store
	store := checkpoint.NewStore("./checkpoints_data")

	// 2. Create graph components
	tpl := createChatTemplate(ctx)
	cm := createChatModel(ctx)
	tn := createToolsNode(ctx)

	// 3. Create graph
	runner, err := graph.NewGraph[map[string]any, *schema.Message](ctx, graph.Config{
		ChatTemplate: tpl,
		ChatModel:    cm,
		ToolsNode:    tn,
		CheckPointStore: store.ToComposeStore(),
		InterruptBeforeNodes: []string{"ToolsNode"},
	})
	if err != nil {
		log.Fatal(err)
	}

	// 4. Execute with interrupt handling
	input := map[string]any{
		"name":     "Megumin",
		"location": "Beijing",
	}

	for {
		result, err := runner.Invoke(ctx, input, compose.WithCheckPointID("example-1"))
		if err == nil {
			fmt.Printf("Final result: %s\n", result.Content)
			return
		}

		// Handle interrupt
		info, ok := compose.ExtractInterruptInfo(err)
		if !ok {
			log.Fatal(err)
		}

		state := info.State.(*types.UniversalState)

		// Display state and handle user confirmation
		interaction.DisplayState(state)
		if err := interaction.HandleToolCalls(state); err != nil {
			log.Fatal(err)
		}

		// Save pending state for resume
		if err := checkpoint.SavePendingState(store.GetBaseDir(), "example-1", state); err != nil {
			log.Printf("Failed to save pending state: %v", err)
		}

		fmt.Println("\nResuming execution...")
	}
}

// ResumeExample demonstrates resuming from a checkpoint
func ResumeExample() {
	ctx := context.Background()
	store := checkpoint.NewStore("./checkpoints_data")

	// Load pending state
	state, err := checkpoint.LoadPendingState(store.GetBaseDir(), "example-1")
	if err != nil {
		log.Printf("No pending state found: %v", err)
		return
	}

	fmt.Println("Loaded pending state from overlay")
	interaction.DisplayState(state)

	// Remove overlay after loading
	if err := checkpoint.RemovePendingState(store.GetBaseDir(), "example-1"); err != nil {
		log.Printf("Failed to remove overlay: %v", err)
	}

	// Create runner and resume
	tpl := createChatTemplate(ctx)
	cm := createChatModel(ctx)
	tn := createToolsNode(ctx)

	runner, err := graph.NewGraph[map[string]any, *schema.Message](ctx, graph.Config{
		ChatTemplate: tpl,
		ChatModel:    cm,
		ToolsNode:    tn,
		CheckPointStore: store.ToComposeStore(),
		InterruptBeforeNodes: []string{"ToolsNode"},
	})
	if err != nil {
		log.Fatal(err)
	}

	input := map[string]any{}
	result, err := runner.Invoke(ctx, input,
		compose.WithCheckPointID("example-1"),
		compose.WithStateModifier(func(ctx context.Context, path compose.NodePath, s any) error {
			if st, ok := s.(*types.UniversalState); ok {
				*st = *state
				return nil
			}
			return fmt.Errorf("unexpected state type: %T", s)
		}),
	)

	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Final result: %s\n", result.Content)
}

// ListCheckpointsExample demonstrates listing checkpoints
func ListCheckpointsExample() {
	store := checkpoint.NewStore("./checkpoints_data")

	checkpoints, err := checkpoint.ListCheckpoints(store.GetBaseDir())
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d checkpoints:\n", len(checkpoints))
	for _, cp := range checkpoints {
		fmt.Printf("  - ID: %s, Created: %s, Size: %d\n", cp.ID, cp.CreatedAt.Format("2006-01-02 15:04:05"), cp.Size)
	}
}

// Helper functions

type bookInput struct {
	Location             string `json:"location"`
	PassengerName        string `json:"passenger_name"`
	PassengerPhoneNumber string `json:"passenger_phone_number"`
}

func createChatTemplate(_ context.Context) prompt.ChatTemplate {
	return prompt.FromMessages(schema.FString,
		schema.SystemMessage("You are a helpful assistant. If the user asks about the booking, call the \"BookTicket\" tool to book ticket."),
		schema.UserMessage("I'm {name}. Help me book a ticket to {location}"),
	)
}

func createChatModel(ctx context.Context) model.ToolCallingChatModel {
	cm, err := openai.NewChatModel(ctx, &openai.ChatModelConfig{
		APIKey:  os.Getenv("OPENAI_API_KEY"),
		Model:   os.Getenv("OPENAI_MODEL"),
		BaseURL: os.Getenv("OPENAI_BASE_URL"),
	})
	if err != nil {
		log.Fatal(err)
	}

	tools := getTools()
	var toolsInfo []*schema.ToolInfo
	for _, t := range tools {
		info, err := t.Info(ctx)
		if err != nil {
			log.Fatal(err)
		}
		toolsInfo = append(toolsInfo, info)
	}

	if err := cm.BindTools(toolsInfo); err != nil {
		log.Fatal(err)
	}
	return cm
}

func createToolsNode(ctx context.Context) *compose.ToolsNode {
	tools := getTools()

	tn, err := compose.NewToolNode(ctx, &compose.ToolsNodeConfig{Tools: tools})
	if err != nil {
		log.Fatal(err)
	}
	return tn
}

func getTools() []tool.BaseTool {
	toolBookTicket, err := utils.InferTool("BookTicket", "this tool can book ticket of the specific location",
		func(ctx context.Context, input bookInput) (output string, err error) {
			fmt.Printf("[tool] BookTicket is booking ticket to %s for %s (%s)\n",
				input.Location, input.PassengerName, input.PassengerPhoneNumber)
			return fmt.Sprintf("tool BookTicket succeeded, the input info is: (%s, %s, %s)",
				input.Location, input.PassengerName, input.PassengerPhoneNumber), nil
		})
	if err != nil {
		log.Fatal(err)
	}

	return []tool.BaseTool{toolBookTicket}
}