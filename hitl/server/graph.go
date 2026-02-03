package server

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/prompt"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"eino_testing/hitl/pkg/types"
)

type bookInput struct {
	Location             string `json:"location"`
	PassengerName        string `json:"passenger_name"`
	PassengerPhoneNumber string `json:"passenger_phone_number"`
}

func composeGraph[I, O any](
	ctx context.Context,
	tpl prompt.ChatTemplate,
	cm model.ToolCallingChatModel,
	tn *compose.ToolsNode,
	store compose.CheckPointStore,
) (compose.Runnable[I, O], error) {
	g := compose.NewGraph[I, O](compose.WithGenLocalState(func(ctx context.Context) *types.UniversalState {
		return types.NewUniversalState()
	}))

	if err := addChatTemplateNode(g, tpl); err != nil {
		return nil, err
	}
	if err := addChatModelNode(g, cm); err != nil {
		return nil, err
	}
	if err := addToolsNode(g, tn); err != nil {
		return nil, err
	}
	if err := addEdges(g); err != nil {
		return nil, err
	}

	return g.Compile(
		ctx,
		compose.WithCheckPointStore(store),
		compose.WithInterruptBeforeNodes([]string{"ToolsNode"}),
	)
}

func addChatTemplateNode[I, O any](g *compose.Graph[I, O], tpl prompt.ChatTemplate) error {
	return g.AddChatTemplateNode(
		"ChatTemplate",
		tpl,
		compose.WithStatePreHandler(func(ctx context.Context, in map[string]any, state *types.UniversalState) (map[string]any, error) {
			// Save initial input to context
			for k, v := range in {
				state.Context[k] = v
			}
			state.NodeExecutionLog["ChatTemplate"] = map[string]any{
				"input": in,
				"time":  time.Now().UnixNano(),
			}
			return in, nil
		}),
		compose.WithStatePostHandler(func(ctx context.Context, out []*schema.Message, state *types.UniversalState) ([]*schema.Message, error) {
			state.MessageHistory = append(state.MessageHistory, out...)
			state.SavedAt = time.Now().UnixNano()
			return out, nil
		}),
	)
}

func addChatModelNode[I, O any](g *compose.Graph[I, O], cm model.ToolCallingChatModel) error {
	return g.AddChatModelNode(
		"ChatModel",
		cm,
		compose.WithStatePreHandler(func(ctx context.Context, in []*schema.Message, state *types.UniversalState) ([]*schema.Message, error) {
			state.MessageHistory = append(state.MessageHistory, in...)
			state.NodeExecutionLog["ChatModel_input"] = map[string]any{
				"message_count": len(in),
				"time":          time.Now().UnixNano(),
			}
			return state.MessageHistory, nil
		}),
		compose.WithStatePostHandler(func(ctx context.Context, out *schema.Message, state *types.UniversalState) (*schema.Message, error) {
			state.MessageHistory = append(state.MessageHistory, out)
			state.NodeExecutionLog["ChatModel_output"] = map[string]any{
				"message_role":    out.Role,
				"has_tool_calls":  len(out.ToolCalls) > 0,
				"tool_call_count": len(out.ToolCalls),
				"time":            time.Now().UnixNano(),
			}
			state.SavedAt = time.Now().UnixNano()
			return out, nil
		}),
	)
}

func addToolsNode[I, O any](g *compose.Graph[I, O], tn *compose.ToolsNode) error {
	return g.AddToolsNode(
		"ToolsNode",
		tn,
		compose.WithStatePreHandler(func(ctx context.Context, in *schema.Message, state *types.UniversalState) (*schema.Message, error) {
			if len(state.MessageHistory) > 0 {
				lastMsg := state.MessageHistory[len(state.MessageHistory)-1]
				state.NodeExecutionLog["ToolsNode_input"] = map[string]any{
					"tool_call_count": len(lastMsg.ToolCalls),
					"time":            time.Now().UnixNano(),
				}
				return lastMsg, nil
			}
			return in, nil
		}),
		compose.WithStatePostHandler(func(ctx context.Context, out []*schema.Message, state *types.UniversalState) ([]*schema.Message, error) {
			if len(out) > 0 {
				state.MessageHistory = append(state.MessageHistory, out...)
				first := out[0]
				state.NodeExecutionLog["ToolsNode_output"] = map[string]any{
					"message_role": first.Role,
					"has_content":  len(first.Content) > 0,
					"time":         time.Now().UnixNano(),
				}
			}
			state.SavedAt = time.Now().UnixNano()
			return out, nil
		}),
	)
}

func addEdges[I, O any](g *compose.Graph[I, O]) error {
	edges := []struct {
		from, to string
	}{
		{compose.START, "ChatTemplate"},
		{"ChatTemplate", "ChatModel"},
		{"ToolsNode", "ChatModel"},
	}

	for _, e := range edges {
		if err := g.AddEdge(e.from, e.to); err != nil {
			return err
		}
	}

	return g.AddBranch("ChatModel", compose.NewGraphBranch(
		func(ctx context.Context, in *schema.Message) (string, error) {
			if len(in.ToolCalls) > 0 {
				return "ToolsNode", nil
			}
			return compose.END, nil
		},
		map[string]bool{"ToolsNode": true, compose.END: true},
	))
}

func newChatTemplate(_ context.Context) prompt.ChatTemplate {
	return prompt.FromMessages(schema.FString,
		schema.SystemMessage("You are a helpful assistant. If the user asks about the booking, call the \"BookTicket\" tool to book ticket."),
		schema.UserMessage("I'm {name}. Help me book a ticket to {location}"),
	)
}

func newChatModel(ctx context.Context) model.ToolCallingChatModel {
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

func newToolsNode(ctx context.Context) *compose.ToolsNode {
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

type myStore struct {
	baseDir string
}

func newMyStore(ctx context.Context, baseDir string) compose.CheckPointStore {
	if baseDir == "" {
		baseDir = "./checkpoints"
	}

	if err := os.MkdirAll(baseDir, 0755); err != nil {
		log.Fatalf("Failed to create checkpoints directory: %v", err)
	}

	return &myStore{baseDir: baseDir}
}

func (m *myStore) Get(ctx context.Context, checkPointID string) ([]byte, bool, error) {
	filePath := m.baseDir + "/" + checkPointID + ".json"

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
	filePath := m.baseDir + "/" + checkPointID + ".json"

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
