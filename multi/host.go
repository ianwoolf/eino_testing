package multi

import (
	"context"
	"fmt"

	"github.com/cloudwego/eino-ext/components/model/ark"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/flow/agent"
	"github.com/cloudwego/eino/flow/agent/multiagent/host"
	"github.com/cloudwego/eino/flow/agent/react"
	"github.com/cloudwego/eino/schema"
)

func NewHost(ctx context.Context, cmConfig *ark.ChatModelConfig) (*host.Host, error) {
	chatModel, err := ark.NewChatModel(ctx, cmConfig)
	if err != nil {
		fmt.Printf("failed to create chat model: %v", err)
		return nil, err
	}

	return &host.Host{
		ToolCallingModel: chatModel,
		SystemPrompt:     "你是一个智能助手，你可以调用不同的专家同时计算加法和减法，也可以调用相关专家分析问题。你可以根据需要并行或者分步骤多次调用专家。你可以分析问题需要哪些专家进行处理。但只能分析并调用需要的专家进行处理问题，不能回答问题。",
	}, nil
}

func NewSpecialist(ctx context.Context, cmConfig *ark.ChatModelConfig, agentMeta host.AgentMeta, invokeableTool tool.InvokableTool) (*host.Specialist, error) {
	chatModel, err := ark.NewChatModel(ctx, cmConfig)
	if err != nil {
		fmt.Printf("failed to create chat model: %v", err)
		return nil, err
	}

	raAgent, err := react.NewAgent(ctx, &react.AgentConfig{
		ToolCallingModel: chatModel,
		ToolsConfig: compose.ToolsNodeConfig{
			Tools: []tool.BaseTool{invokeableTool},
		},
	})
	if err != nil {
		return nil, err
	}
	return &host.Specialist{
		AgentMeta: agentMeta,
		Invokable: func(ctx context.Context, input []*schema.Message, opts ...agent.AgentOption) (*schema.Message, error) {
			return raAgent.Generate(ctx, input, opts...)
		},
	}, nil
}
