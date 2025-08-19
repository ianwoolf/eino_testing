package multi_agent

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/cloudwego/eino-ext/components/model/ark"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/flow/agent/multiagent/host"
	"github.com/cloudwego/eino/schema"
)

func NewAnalyzeSpecialist(ctx context.Context, cmConfig, analysisCMCOnfig *ark.ChatModelConfig) (*host.Specialist, error) {
	agentMeta := host.AgentMeta{
		Name:        "analysis_specialist",
		IntendedUse: "analysis the difficulty of the content",
	}
	invokeableTool := newAnalyzeTool(analysisCMCOnfig)
	return NewSpecialist(ctx, cmConfig, agentMeta, invokeableTool)
}

type AnalyzeTool struct {
	ChatModelConfig *ark.ChatModelConfig
}

func newAnalyzeTool(cmConfig *ark.ChatModelConfig) tool.InvokableTool {
	return &AnalyzeTool{
		ChatModelConfig: cmConfig,
	}
}

type AnalyzeParam struct {
	Content string `json:"content"`
}

func (a *AnalyzeTool) Info(ctx context.Context) (*schema.ToolInfo, error) {
	return &schema.ToolInfo{
		Name: "analyze",
		Desc: "analyze the difficulty of the math question",
		ParamsOneOf: schema.NewParamsOneOfByParams(map[string]*schema.ParameterInfo{
			"content": {
				Type:     "string",
				Desc:     "content to be analyzed",
				Required: true,
			},
		}),
	}, nil
}
func (a *AnalyzeTool) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...tool.Option) (string, error) {
	fmt.Println("AnalyzeTool.InvokableRun...")
	p := &AnalyzeParam{}
	err := json.Unmarshal([]byte(argumentsInJSON), p)
	if err != nil {
		return "", err
	}

	arkModel, err := ark.NewChatModel(ctx, a.ChatModelConfig)
	if err != nil {
		fmt.Printf("failed to create chat model: %v", err)
		return "", err
	}

	AnalyzeInput := []*schema.Message{
		{
			Role:    schema.System,
			Content: "你是一个数学老师。你需要分析用户的问题，判断用户的问题的难度，不能回答任何问题，也不能分析解答用户的问题。只能根据用户的问题判断难度，给出一个难度的评分。难度分为简单、中等、困难。评分范围为1-10，1为简单，10为困难",
		},
		{
			Role:    schema.User,
			Content: p.Content,
		},
	}
	response, err := arkModel.Generate(ctx, AnalyzeInput)
	if err != nil {
		fmt.Printf("failed to generate: %v", err)
		return "", err
	}
	fmt.Printf("[AnalyzeTool.InvokableRun] %s\n", response.Content)
	return response.Content, nil
}
