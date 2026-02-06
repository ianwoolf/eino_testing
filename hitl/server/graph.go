package server

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
	// 使用新的graph包创建工作流图
	return graph.NewGraph[I, O](ctx, graph.Config{
		ChatTemplate: tpl,
		ChatModel:    cm,
		ToolsNode:    tn,
		CheckPointStore: store,
		InterruptBeforeNodes: []string{"ToolsNode"},
	})
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

// 新的检查点存储创建函数
func newCheckPointStore(ctx context.Context, baseDir string) compose.CheckPointStore {
	store := checkpoint.NewStore(baseDir)
	return store.ToComposeStore()
}