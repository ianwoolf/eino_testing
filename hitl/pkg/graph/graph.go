package graph

import (
	"context"
	"time"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/prompt"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"eino_testing/hitl/pkg/types"
)

// Config holds configuration for graph creation
type Config struct {
	ChatTemplate prompt.ChatTemplate
	ChatModel    model.ToolCallingChatModel
	ToolsNode    *compose.ToolsNode
	CheckPointStore compose.CheckPointStore
	InterruptBeforeNodes []string
}

// NewGraph creates a new workflow graph
func NewGraph[I, O any](ctx context.Context, cfg Config) (compose.Runnable[I, O], error) {
	g := compose.NewGraph[I, O](compose.WithGenLocalState(func(ctx context.Context) *types.UniversalState {
		return types.NewUniversalState()
	}))

	if err := AddChatTemplateNode(g, cfg.ChatTemplate); err != nil {
		return nil, err
	}
	if err := AddChatModelNode(g, cfg.ChatModel); err != nil {
		return nil, err
	}
	if err := AddToolsNode(g, cfg.ToolsNode); err != nil {
		return nil, err
	}
	if err := AddEdges(g); err != nil {
		return nil, err
	}

	interruptNodes := cfg.InterruptBeforeNodes
	if len(interruptNodes) == 0 {
		interruptNodes = []string{"ToolsNode"}
	}

	return g.Compile(
		ctx,
		compose.WithCheckPointStore(cfg.CheckPointStore),
		compose.WithInterruptBeforeNodes(interruptNodes),
	)
}

// AddChatTemplateNode adds a chat template node to the graph
func AddChatTemplateNode[I, O any](g *compose.Graph[I, O], tpl prompt.ChatTemplate) error {
	return g.AddChatTemplateNode(
		"ChatTemplate",
		tpl,
		compose.WithStatePreHandler(func(ctx context.Context, in map[string]any, state *types.UniversalState) (map[string]any, error) {
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

// AddChatModelNode adds a chat model node to the graph
func AddChatModelNode[I, O any](g *compose.Graph[I, O], cm model.ToolCallingChatModel) error {
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

// AddToolsNode adds a tools node to the graph
func AddToolsNode[I, O any](g *compose.Graph[I, O], tn *compose.ToolsNode) error {
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

// AddEdges adds edges to the graph
func AddEdges[I, O any](g *compose.Graph[I, O]) error {
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