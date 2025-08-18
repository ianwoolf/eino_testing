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

func NewAddSpecialist(ctx context.Context, cmConfig *ark.ChatModelConfig) (*host.Specialist, error) {
	agentMeta := host.AgentMeta{
		Name:        "add_specialist",
		IntendedUse: "add two numbers and return the result. cannot analysis the difficulty of the problem, only add the numbers.",
	}
	invokeableTool := newAddTool()
	return NewSpecialist(ctx, cmConfig, agentMeta, invokeableTool)
}

type AddTool struct {
}

func newAddTool() tool.InvokableTool {
	return &AddTool{}
}

type AddParam struct {
	A int `json:"a"`
	B int `json:"b"`
}

func (t *AddTool) Info(ctx context.Context) (*schema.ToolInfo, error) {
	return &schema.ToolInfo{
		Name: "add",
		Desc: "add two numbers",
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

func (t *AddTool) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...tool.Option) (string, error) {
	fmt.Println("AddTool.InvokableRun...")
	p := &AddParam{}
	err := json.Unmarshal([]byte(argumentsInJSON), p)
	if err != nil {
		return "", err
	}
	fmt.Printf("[AddTool.InvokableRun] %+v, %d\n", p, p.A+p.B)
	return fmt.Sprintf("%d", p.A+p.B), nil
}
