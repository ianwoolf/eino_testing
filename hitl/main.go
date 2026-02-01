package main

import (
	"bufio"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/prompt"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()

	// CLI flags
	var baseDir string
	var checkpointID string
	var exitAfterConfirm bool
	flag.StringVar(&baseDir, "base-dir", "./checkpoints_data", "directory to store checkpoints and overlays")
	flag.StringVar(&checkpointID, "checkpoint-id", "1", "checkpoint id to use")
	flag.BoolVar(&exitAfterConfirm, "exit-after-confirm", false, "if set, process will exit immediately after saving confirmation overlay")

	var simulate bool
	flag.BoolVar(&simulate, "simulate", false, "run in simulate mode (no external model calls) for testing")
	flag.Parse()

	// 注册通用状态类型
	_ = compose.RegisterSerializableType[*UniversalState]("universal_state")

	ctx := context.Background()

	// If simulate mode, skip creating runner to avoid external calls
	var runner compose.Runnable[map[string]any, *schema.Message]
	if !simulate {
		runner, err = composeGraph[map[string]any, *schema.Message](
			ctx,
			newChatTemplate(ctx),
			newChatModel(ctx),
			newToolsNode(ctx),
			NewCheckPointStore(ctx, baseDir),
		)
		if err != nil {
			log.Fatal(err)
		}
	}

	// pendingState 用来在恢复时注入修改过的状态
	var pendingState *UniversalState

	for {
		// 初始化输入
		input := map[string]any{
			"name":     "Megumin",
			"location": "Beijing",
		}

		// If simulate mode, run a simplified HITL flow without external model
		if simulate {
			// If an overlay exists, load it and simulate resumed execution
			if _, errLoad := loadPendingState(baseDir, checkpointID); errLoad == nil {
				fmt.Printf("Loaded pending overlay for checkpoint %s\n", checkpointID)
				// remove overlay after loading
				_ = os.Remove(filepath.Join(baseDir, checkpointID+".confirm.json"))
				fmt.Println("\nResuming execution (simulated, from overlay)...")
				fmt.Println("final result: Your ticket to Beijing has been successfully booked, Megumin!")
				break
			}

			// construct a simulated state with a pending tool call
			s := &UniversalState{
				MessageHistory: []*schema.Message{
					{
						Role: schema.Assistant,
						ToolCalls: []schema.ToolCall{{
							Function: schema.FunctionCall{Name: "BookTicket", Arguments: "{\"location\": \"Beijing\", \"passenger_name\": \"Megumin\", \"passenger_phone_number\": \"1234567890\"}"},
						}},
					},
				},
				Context:          map[string]any{"name": "Megumin", "location": "Beijing"},
				NodeExecutionLog: map[string]any{},
				SavedAt:          time.Now().UnixNano(),
			}

			// Display and interact (reuse same logic as the real flow)
			fmt.Printf("\n=== Simulated Execution Interrupted ===\n")
			fmt.Printf("Saved at: %s\n\n", time.Unix(0, s.SavedAt).Format(time.RFC3339))
			fmt.Println("Current Context:")
			for k, v := range s.Context {
				fmt.Printf("  %s: %v\n", k, v)
			}
			fmt.Printf("\nMessage History (%d messages):\n", len(s.MessageHistory))
			for i, msg := range s.MessageHistory {
				fmt.Printf("  [%d] Role: %s\n", i, msg.Role)
				if len(msg.ToolCalls) > 0 {
					for j, tc := range msg.ToolCalls {
						fmt.Printf("        [%d] %s with args: %s\n", j, tc.Function.Name, tc.Function.Arguments)
					}
				}
			}

			// ask for confirmation
			fmt.Print("Are the arguments as expected? (y/n): ")
			var resp string
			fmt.Scanln(&resp)
			if strings.ToLower(resp) == "n" {
				fmt.Print("Please enter the modified arguments: ")
				scan := bufio.NewScanner(os.Stdin)
				if scan.Scan() {
					s.MessageHistory[len(s.MessageHistory)-1].ToolCalls[0].Function.Arguments = scan.Text()
					// save overlay
					if err := savePendingState(baseDir, checkpointID, s); err != nil {
						log.Printf("failed to save pending state overlay: %v", err)
					}
					if exitAfterConfirm {
						fmt.Printf("Saved confirmation overlay to %s and exiting (exit-after-confirm=true)\n", filepath.Join(baseDir, checkpointID+".confirm.json"))
						os.Exit(0)
					}
				}
			}

			// simulate resume
			fmt.Println("\nResuming execution (simulated)...")
			fmt.Println("final result: Your ticket to Beijing has been successfully booked, Megumin!")
			break
		}

		var result *schema.Message
		var err error
		// 如果 overlay 文件存在（可能是之前保存的确认状态），优先加载
		if pendingState == nil {
			if s, errLoad := loadPendingState(baseDir, checkpointID); errLoad == nil {
				pendingState = s
				log.Printf("loaded pending state overlay from disk")
			}
		}

		// 调用 runner：如果存在 pendingState，注入 state modifier
		opts := []compose.Option{compose.WithCheckPointID(checkpointID)}
		if pendingState != nil {
			opts = append(opts, compose.WithStateModifier(func(ctx context.Context, path compose.NodePath, state any) error {
				*state.(*UniversalState) = *pendingState
				return nil
			}))
			_ = os.Remove(filepath.Join(baseDir, checkpointID+".confirm.json"))
		}
		result, err = runner.Invoke(ctx, input, opts...)
		if err == nil {
			fmt.Printf("final result: %s\n", result.Content)
			break
		}
		pendingState = nil

		// 提取中断信息
		info, ok := compose.ExtractInterruptInfo(err)
		if !ok {
			log.Fatal(err)
		}

		state := info.State.(*UniversalState)

		// 显示当前上下文信息
		fmt.Println("Current Context:")
		for key, value := range state.Context {
			fmt.Printf("  %s: %v\n", key, value)
		}

		// 显示消息历史
		fmt.Printf("\nMessage History (%d messages):\n", len(state.MessageHistory))
		for i, msg := range state.MessageHistory {
			fmt.Printf("  [%d] Role: %s\n", i, msg.Role)
			if len(msg.Content) > 100 {
				fmt.Printf("      Content: %s...\n", msg.Content[:100])
			} else {
				fmt.Printf("      Content: %s\n", msg.Content)
			}
			if len(msg.ToolCalls) > 0 {
				fmt.Printf("      Tool calls: %d\n", len(msg.ToolCalls))
				for j, tc := range msg.ToolCalls {
					fmt.Printf("        [%d] %s with args: %s\n", j, tc.Function.Name, tc.Function.Arguments)
				}
			}
		}

		// 处理 tool calls
		if len(state.MessageHistory) > 0 && len(state.MessageHistory[len(state.MessageHistory)-1].ToolCalls) > 0 {
			lastMsg := state.MessageHistory[len(state.MessageHistory)-1]
			for i, tc := range lastMsg.ToolCalls {
				fmt.Printf("\nTool Call [%d]: %s\n", i, tc.Function.Name)
				fmt.Printf("Arguments: %s\n", tc.Function.Arguments)
				fmt.Print("Are the arguments as expected? (y/n): ")

				var response string
				fmt.Scanln(&response)

				if strings.ToLower(response) == "n" {
					fmt.Print("Please enter the modified arguments: ")
					scanner := bufio.NewScanner(os.Stdin)
					if scanner.Scan() {
						newArgs := scanner.Text()
						lastMsg.ToolCalls[i].Function.Arguments = newArgs
						fmt.Printf("Updated arguments to: %s\n", newArgs)
						// 将修改写回 checkpoint 文件（best-effort），便于快速查看
						if err := updateCheckpointArguments(baseDir, checkpointID, newArgs); err != nil {
							log.Printf("failed to update checkpoint arguments on disk: %v", err)
						}
					}
				}

				// 将修改过的 state 深拷贝保存到 pendingState，用于下一次恢复时注入
				pendingState = deepCopyState(state)
				// 同时持久化到一个 overlay 文件，这样即使进程重启我们也能加载并注入修改
				if err := savePendingState(baseDir, checkpointID, pendingState); err != nil {
					log.Printf("failed to save pending state overlay: %v", err)
				}
				// 根据 flag 决定是否在保存 overlay 后退出（用于重启测试）
				if exitAfterConfirm {
					fmt.Printf("Saved confirmation overlay to %s and exiting (exit-after-confirm=true)\n", filepath.Join(baseDir, checkpointID+".confirm.json"))
					os.Exit(0)
				}

			}
		}

		fmt.Println("\nResuming execution...")
	}
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

	err = cm.BindTools(toolsInfo)
	if err != nil {
		log.Fatal(err)
	}
	return cm
}

// UniversalState 是通用的状态结构，可以保存所有上下文信息
type UniversalState struct {
	// 消息历史
	MessageHistory []*schema.Message `json:"message_history"`

	// 通用上下文存储，可以存储任意类型的数据
	Context map[string]any `json:"context"`

	// 节点执行记录
	NodeExecutionLog map[string]any `json:"node_execution_log"`

	// 保存时间戳（UnixNano）
	SavedAt int64 `json:"saved_at"`
}

type bookInput struct {
	Location             string `json:"location"`
	PassengerName        string `json:"passenger_name"`
	PassengerPhoneNumber string `json:"passenger_phone_number"`
}

func newToolsNode(ctx context.Context) *compose.ToolsNode {
	tools := getTools()

	tn, err := compose.NewToolNode(ctx, &compose.ToolsNodeConfig{Tools: tools})
	if err != nil {
		log.Fatal(err)
	}
	return tn
}

// deepCopyState 使用 JSON 序列化/反序列化做深拷贝，便于将修改后的 state 在下一次恢复时注入
func deepCopyState(s *UniversalState) *UniversalState {
	b, err := json.Marshal(s)
	if err != nil {
		log.Printf("failed to marshal state for deep copy: %v", err)
		return s
	}
	var ns UniversalState
	if err := json.Unmarshal(b, &ns); err != nil {
		log.Printf("failed to unmarshal state for deep copy: %v", err)
		return s
	}
	return &ns
}

func composeGraph[I, O any](ctx context.Context, tpl prompt.ChatTemplate, cm model.ToolCallingChatModel, tn *compose.ToolsNode, store compose.CheckPointStore) (compose.Runnable[I, O], error) {
	g := compose.NewGraph[I, O](compose.WithGenLocalState(func(ctx context.Context) *UniversalState {
		return &UniversalState{
			MessageHistory:   make([]*schema.Message, 0),
			Context:          make(map[string]any),
			NodeExecutionLog: make(map[string]any),
			SavedAt:          time.Now().UnixNano(),
		}
	}))

	err := g.AddChatTemplateNode(
		"ChatTemplate",
		tpl,
		// ChatTemplate 的 PreHandler - 保存输入参数
		compose.WithStatePreHandler(func(ctx context.Context, in map[string]any, state *UniversalState) (map[string]any, error) {
			// 保存初始输入到上下文
			for k, v := range in {
				state.Context[k] = v
			}
			// 记录执行日志
			state.NodeExecutionLog["ChatTemplate"] = map[string]any{
				"input": in,
				"time":  time.Now().UnixNano(),
			}
			return in, nil
		}),
		// ChatTemplate 的 PostHandler - 保存输出
		compose.WithStatePostHandler(func(ctx context.Context, out []*schema.Message, state *UniversalState) ([]*schema.Message, error) {
			state.MessageHistory = append(state.MessageHistory, out...)
			state.SavedAt = time.Now().UnixNano()
			return out, nil
		}),
	)
	if err != nil {
		return nil, err
	}

	err = g.AddChatModelNode(
		"ChatModel",
		cm,
		// ChatModel 的 PreHandler - 保存输入消息
		compose.WithStatePreHandler(func(ctx context.Context, in []*schema.Message, state *UniversalState) ([]*schema.Message, error) {
			state.MessageHistory = append(state.MessageHistory, in...)
			state.NodeExecutionLog["ChatModel_input"] = map[string]any{
				"message_count": len(in),
				"time":          time.Now().UnixNano(),
			}
			return state.MessageHistory, nil
		}),
		// ChatModel 的 PostHandler - 保存输出消息
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
	if err != nil {
		return nil, err
	}

	err = g.AddToolsNode(
		"ToolsNode",
		tn,
		// ToolsNode 的 PreHandler - 获取最后的工具调用消息
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
		// ToolsNode 的 PostHandler - 保存工具执行结果
		compose.WithStatePostHandler(func(ctx context.Context, out []*schema.Message, state *UniversalState) ([]*schema.Message, error) {
			if len(out) > 0 {
				state.MessageHistory = append(state.MessageHistory, out...)
				// 记录首条消息的摘要信息
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
	if err != nil {
		return nil, err
	}

	err = g.AddEdge(compose.START, "ChatTemplate")
	if err != nil {
		return nil, err
	}
	err = g.AddEdge("ChatTemplate", "ChatModel")
	if err != nil {
		return nil, err
	}
	err = g.AddEdge("ToolsNode", "ChatModel")
	if err != nil {
		return nil, err
	}
	err = g.AddBranch("ChatModel", compose.NewGraphBranch(func(ctx context.Context, in *schema.Message) (endNode string, err error) {
		if len(in.ToolCalls) > 0 {
			return "ToolsNode", nil
		}
		return compose.END, nil
	}, map[string]bool{"ToolsNode": true, compose.END: true}))
	if err != nil {
		return nil, err
	}

	return g.Compile(
		ctx,
		compose.WithCheckPointStore(store),
		compose.WithInterruptBeforeNodes([]string{"ToolsNode"}),
	)
}

// updateCheckpointArguments 在 checkpoint JSON 中替换最后一个带 tool call 的消息中的 arguments 字段
func updateCheckpointArguments(baseDir, checkpointID, newArgs string) error {
	path := filepath.Join(baseDir, checkpointID+".json")
	b, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read checkpoint file: %w", err)
	}
	var root map[string]any
	if err := json.Unmarshal(b, &root); err != nil {
		return fmt.Errorf("unmarshal checkpoint json: %w", err)
	}

	// navigate to MapValues.State.MapValues.MessageHistory.SliceValues
	mv, ok := root["MapValues"].(map[string]any)
	if !ok {
		return fmt.Errorf("invalid checkpoint format: MapValues missing")
	}
	state, ok := mv["State"].(map[string]any)
	if !ok {
		return fmt.Errorf("invalid checkpoint format: State missing")
	}
	sv, ok := state["MapValues"].(map[string]any)
	if !ok {
		return fmt.Errorf("invalid checkpoint format: State.MapValues missing")
	}
	mh, ok := sv["MessageHistory"].(map[string]any)
	if !ok {
		return fmt.Errorf("invalid checkpoint format: MessageHistory missing")
	}
	slice, ok := mh["SliceValues"].([]any)
	if !ok || len(slice) == 0 {
		return fmt.Errorf("no messages in message history")
	}

	// find last message that has ToolCalls.SliceValues with length>0
	for i := len(slice) - 1; i >= 0; i-- {
		msg, ok := slice[i].(map[string]any)
		if !ok {
			continue
		}
		mapvals, ok := msg["MapValues"].(map[string]any)
		if !ok {
			continue
		}
		toolCalls, ok := mapvals["ToolCalls"].(map[string]any)
		if !ok {
			continue
		}
		sv2, ok := toolCalls["SliceValues"].([]any)
		if !ok || len(sv2) == 0 {
			continue
		}
		// update the first tool call's Function.MapValues.Arguments.JSONValue
		first := sv2[0].(map[string]any)
		fmap, ok := first["MapValues"].(map[string]any)
		if !ok {
			continue
		}
		function, ok := fmap["Function"].(map[string]any)
		if !ok {
			continue
		}
		fmap2, ok := function["MapValues"].(map[string]any)
		if !ok {
			continue
		}
		arguments, ok := fmap2["Arguments"].(map[string]any)
		if !ok {
			continue
		}
		// set JSONValue to newArgs string
		arguments["JSONValue"] = newArgs

		// write back
		nb, err := json.MarshalIndent(root, "", "  ")
		if err != nil {
			return fmt.Errorf("marshal checkpoint json: %w", err)
		}
		temp := path + ".tmp"
		if err := os.WriteFile(temp, nb, 0644); err != nil {
			return fmt.Errorf("write temp checkpoint: %w", err)
		}
		if err := os.Rename(temp, path); err != nil {
			_ = os.Remove(temp)
			return fmt.Errorf("rename temp checkpoint: %w", err)
		}
		return nil
	}

	return fmt.Errorf("no tool call found to update")
}

// savePendingState 会将给定的 state 序列化为 overlay 文件（例如 1.confirm.json）
func savePendingState(baseDir, checkpointID string, s *UniversalState) error {
	path := filepath.Join(baseDir, checkpointID+".confirm.json")
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal pending state: %w", err)
	}
	temp := path + ".tmp"
	if err := os.WriteFile(temp, b, 0644); err != nil {
		return fmt.Errorf("write temp pending state: %w", err)
	}
	if err := os.Rename(temp, path); err != nil {
		_ = os.Remove(temp)
		return fmt.Errorf("rename temp pending state: %w", err)
	}
	return nil
}

func loadPendingState(baseDir, checkpointID string) (*UniversalState, error) {
	path := filepath.Join(baseDir, checkpointID+".confirm.json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil, fmt.Errorf("pending state overlay not found")
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read pending state: %w", err)
	}
	var s UniversalState
	if err := json.Unmarshal(b, &s); err != nil {
		return nil, fmt.Errorf("unmarshal pending state: %w", err)
	}
	return &s, nil
}

func getTools() []tool.BaseTool {
	toolBookTicket, err := utils.InferTool("BookTicket", "this tool can book ticket of the specific location", func(ctx context.Context, input bookInput) (output string, err error) {
		fmt.Printf("[tool] BookTicket is booking ticket to %s for %s (%s)\n", input.Location, input.PassengerName, input.PassengerPhoneNumber)
		return "tool BookTicket succeeded, the input info is: (" + input.Location + ", " + input.PassengerName + ", " + input.PassengerPhoneNumber + ")", nil
	})
	if err != nil {
		log.Fatal(err)
	}

	return []tool.BaseTool{
		toolBookTicket,
	}
}
