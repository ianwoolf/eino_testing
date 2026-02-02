package main

import (
	"context"
	"time"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/prompt"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
)

func composeGraph[I, O any](
	ctx context.Context,
	tpl prompt.ChatTemplate,
	cm model.ToolCallingChatModel,
	tn *compose.ToolsNode,
	store compose.CheckPointStore,
) (compose.Runnable[I, O], error) {
	g := compose.NewGraph[I, O](compose.WithGenLocalState(newUniversalState))

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

func newUniversalState(context.Context) *UniversalState {
	return &UniversalState{
		MessageHistory:   make([]*schema.Message, 0),
		Context:          make(map[string]any),
		NodeExecutionLog: make(map[string]any),
		SavedAt:          time.Now().UnixNano(),
	}
}

func addChatTemplateNode[I, O any](g *compose.Graph[I, O], tpl prompt.ChatTemplate) error {
	return g.AddChatTemplateNode(
		"ChatTemplate",
		tpl,
		compose.WithStatePreHandler(func(ctx context.Context, in map[string]any, state *UniversalState) (map[string]any, error) {
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
		compose.WithStatePostHandler(func(ctx context.Context, out []*schema.Message, state *UniversalState) ([]*schema.Message, error) {
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
		compose.WithStatePreHandler(func(ctx context.Context, in []*schema.Message, state *UniversalState) ([]*schema.Message, error) {
			state.MessageHistory = append(state.MessageHistory, in...)
			state.NodeExecutionLog["ChatModel_input"] = map[string]any{
				"message_count": len(in),
				"time":          time.Now().UnixNano(),
			}
			return state.MessageHistory, nil
		}),
		compose.WithStatePostHandler(func(ctx context.Context, out *schema.Message, state *UniversalState) (*schema.Message, error) {
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
		compose.WithStatePreHandler(func(ctx context.Context, in *schema.Message, state *UniversalState) (*schema.Message, error) {
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
		compose.WithStatePostHandler(func(ctx context.Context, out []*schema.Message, state *UniversalState) ([]*schema.Message, error) {
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
