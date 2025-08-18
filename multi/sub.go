package multi

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/cloudwego/eino-ext/components/model/ark"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/flow/agent/multiagent/host"
	"github.com/cloudwego/eino/schema"
)

func NewSubSpecialist(ctx context.Context, cmConfig *ark.ChatModelConfig) (*host.Specialist, error) {
	agentMeta := host.AgentMeta{
		Name:        "sub_specialist",
		IntendedUse: "sub two numbers and return the result. cannot analysis the difficulty of the problem, only sub first number from second number.",
	}
	invokeableTool := newSubTool()
	return NewSpecialist(ctx, cmConfig, agentMeta, invokeableTool)
}

type SubTool struct {
}

func newSubTool() tool.InvokableTool {
	return &SubTool{}
}

type SubParam struct {
	A int `json:"a"`
	B int `json:"b"`
}

func (t *SubTool) Info(ctx context.Context) (*schema.ToolInfo, error) {
	return &schema.ToolInfo{
		Name: "sub",
		Desc: "sub two numbers",
		ParamsOneOf: schema.NewParamsOneOfByParams(map[string]*schema.ParameterInfo{
			"a": {
				Type:     "number",
				Desc:     "first number",
				Required: true,
			},
			"b": {
				Type:     "number",
				Desc:     "second number",
				Required: true,
			},
		}),
	}, nil
}

func (t *SubTool) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...tool.Option) (string, error) {
	fmt.Println("SubTool.InvokableRun...")
	p := &SubParam{}
	err := json.Unmarshal([]byte(argumentsInJSON), p)
	if err != nil {
		return "", err
	}
	fmt.Printf("[SubTool.InvokableRun] %+v, %d\n", p, p.A-p.B)
	return fmt.Sprintf("%d", p.A-p.B), nil
}
