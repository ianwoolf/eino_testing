# HITL (Human-In-The-Loop) 组件（`hitl`）

## 目标（需求）🎯
- 在工作流运行中，当遇到需要人工确认的步骤（如工具调用）时中断流程，并**保存完整的运行时 state**；
- 支持人工在中断时查看并修改 state（比如工具参数），确认后从上次中断处恢复并继续执行；
- 将修改持久化为 overlay（`.confirm.json`），使进程重启后也能加载并继续。

---

## 新的包结构 🏗️

```
hitl/
├── pkg/                          # 核心包（可被外部调用）
│   ├── types/                    # 通用状态定义
│   ├── checkpoint/               # 检查点管理
│   ├── graph/                    # 工作流图构建
│   └── interaction/              # 用户交互处理
├── examples/                     # 使用示例
├── server/                       # Web服务器
├── ui/                           # 前端界面
├── REFACTORING.md                # 重构文档
└── readme.md                     # 本文档
```

---

## 运行机制 🔄
- Graph（简化）：`ChatTemplate -> ChatModel -> ToolsNode`
- 中断点：通过 `compose.WithInterruptBeforeNodes([]string{"ToolsNode"})` 在 `ToolsNode` 前触发中断供人工确认。
- state 类型：`UniversalState`（通过 `compose.WithGenLocalState` 生成），包含：
  - `MessageHistory`：消息历史（[]*schema.Message）
  - `Context`：任意上下文变量（map[string]any）
  - `NodeExecutionLog`：节点执行摘要
  - `SavedAt`：保存时间（UnixNano int64）
- 中断时：程序会调用 `compose.ExtractInterruptInfo(err)` 获取 `InterruptInfo`，从中取出 `state` 并显示给人工。
- 人工确认流程：
  1. 查看 `state`（`Context`、`MessageHistory`、待执行工具调用等）
  2. 如需修改，输入新的参数（JSON 字符串形式）
  3. 程序会：
     - 将修改深拷贝到 `pendingState`（内存）并通过 `checkpoint.SavePendingState()` 写入 `./checkpoints_data/<id>.confirm.json`（overlay）
     - （best-effort）尝试使用 `checkpoint.UpdateCheckpointArguments()` 修改官方 checkpoint JSON 以便更快肉眼可见
  4. 继续执行或重启后自动加载 overlay 并注入修改（通过 `compose.WithStateModifier`）

---

## 关键实现点（代码要点）🔧
- **`pkg/types/state.go`**：`UniversalState` 定义，承载运行时变量
- **`pkg/checkpoint/overlay.go`**：overlay 持久化与加载
  - `checkpoint.SavePendingState()` / `checkpoint.LoadPendingState()`
  - `checkpoint.UpdateCheckpointArguments()`：best-effort 修改官方 checkpoint JSON
- **`pkg/graph/graph.go`**：工作流图构建
  - `graph.NewGraph()`：创建工作流图
- **`pkg/interaction/interaction.go`**：用户交互处理
  - `interaction.HandleToolCalls()`：处理工具调用确认
- **恢复注入**：在下一次 `runner.Invoke` 前检测 `pendingState` 或 overlay，若存在则通过 `compose.WithStateModifier` 注入，然后继续执行

---

## 注意事项 & 限制 ⚠️
- `updateCheckpointArguments` 为对 checkpoint JSON 的局部字符串替换，**可能会被框架后续保存覆盖**，不能作为最终一致性保证；推荐使用 overlay (`*.confirm.json`) 做持久化。
- 在注入修改后的 state 时应确保修改数据与预期结构一致，避免导致后续节点解析异常。
- `UniversalState` 中尽量使用基础可序列化类型（string/int/bool/map/array），以避免序列化错误。

---

## 安装

### 安装必需软件

    go version    # >=1.21
    node --version # >=18.0
    npm --version  # >=8.0

### 配置环境变量

    cd eino_testing/hitl/

#### .env

    cat > .env << 'EOF'
    OPENAI_API_KEY=your_api_key_here
    OPENAI_MODEL=gpt-4
    OPENAI_BASE_URL=https://api.openai.com/v1
    EOF

### 安装依赖

##### Go 依赖

    go mod download

国内镜像（如需要: `go env -w GOPROXY=https://goproxy.cn,direct`

##### 前端依赖和构建

    cd ui
    npm install
    npm run build
    cd ..

### 运行 Web 服务器
  
    go build -o hitl_server server/cmd/main.go 
    go run ./hitl_server --web --web-port 8080

---

## 使用示例

### 基础使用

```go
package main

import (
    "context"
    "log"

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

func main() {
    ctx := context.Background()

    // 1. 创建检查点存储
    store := checkpoint.NewStore("./checkpoints_data")

    // 2. 创建图组件
    tpl := createChatTemplate(ctx)
    cm := createChatModel(ctx)
    tn := createToolsNode(ctx)

    // 3. 创建工作流图
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

    // 4. 执行循环
    input := map[string]any{
        "name":     "Megumin",
        "location": "Beijing",
    }

    for {
        result, err := runner.Invoke(ctx, input, compose.WithCheckPointID("1"))
        
        if err == nil {
            // 执行成功
            log.Printf("Final result: %s", result.Content)
            break
        }
        
        // 提取中断信息
        info, ok := compose.ExtractInterruptInfo(err)
        if !ok {
            log.Fatal(err)
        }
        
        state := info.State.(*types.UniversalState)
        
        // 显示状态并处理工具调用
        interaction.DisplayState(state)
        if err := interaction.HandleToolCalls(state); err != nil {
            log.Fatal(err)
        }
        
        // 保存待处理状态
        if err := checkpoint.SavePendingState(store.GetBaseDir(), "1", state); err != nil {
            log.Printf("Failed to save pending state: %v", err)
        }
        
        // 继续执行...
    }
}

func createChatTemplate(_ context.Context) prompt.ChatTemplate {
    return prompt.FromMessages(schema.FString,
        schema.SystemMessage("You are a helpful assistant. If the user asks about the booking, call the \"BookTicket\" tool to book ticket."),
        schema.UserMessage("I'm {name}. Help me book a ticket to {location}"),
    )
}

func createChatModel(ctx context.Context) model.ToolCallingChatModel {
    cm, err := openai.NewChatModel(ctx, &openai.ChatModelConfig{
        APIKey:  "your_api_key",
        Model:   "gpt-4",
        BaseURL: "https://api.openai.com/v1",
    })
    if err != nil {
        log.Fatal(err)
    }

    tools := createTools()
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
    tools := createTools()

    tn, err := compose.NewToolNode(ctx, &compose.ToolsNodeConfig{Tools: tools})
    if err != nil {
        log.Fatal(err)
    }
    return tn
}

func createTools() []tool.BaseTool {
    type bookInput struct {
        Location             string `json:"location"`
        PassengerName        string `json:"passenger_name"`
        PassengerPhoneNumber string `json:"passenger_phone_number"`
    }

    toolBookTicket, err := utils.InferTool("BookTicket", "this tool can book ticket of the specific location",
        func(ctx context.Context, input bookInput) (output string, err error) {
            return "Tool BookTicket succeeded", nil
        })
    if err != nil {
        log.Fatal(err)
    }

    return []tool.BaseTool{toolBookTicket}
}
```

### 从检查点恢复

```go
// 加载待处理状态
state, err := checkpoint.LoadPendingState("./checkpoints_data", "1")
if err == nil && state != nil {
    // 移除 overlay 文件
    checkpoint.RemovePendingState("./checkpoints_data", "1")
    
    // 使用修改后的状态继续执行
    result, err := runner.Invoke(ctx, input,
        compose.WithCheckPointID("1"),
        compose.WithStateModifier(func(ctx context.Context, path compose.NodePath, s any) error {
            if st, ok := s.(*types.UniversalState); ok {
                *st = *state
                return nil
            }
            return nil
        }),
    )
}
```

---

## 检查点存储

状态会自动保存到磁盘：

```
./checkpoints_data/
├── 1.json          # Checkpoint ID "1" 的完整状态快照（由 compose 保存）
├── 1.confirm.json  # 人工确认的 overlay（持久化层）
└── ...
```

恢复时自动加载对应的检查点。

---

## API 端点

### 执行
- `POST /api/execute` - 开始新的执行
- `POST /api/execute/:id/resume` - 恢复执行
- `GET /api/executions` - 列出所有执行
- `GET /api/executions/:id` - 获取执行详情
- `GET /api/state/:id` - 获取当前状态
- `GET /api/logs/:id` - 获取执行日志

### 工具调用确认
- `POST /api/confirm` - 确认或拒绝工具调用

### 检查点
- `GET /api/checkpoints` - 列出所有检查点
- `DELETE /api/checkpoints/:id` - 删除检查点

### WebSocket
- `GET /ws/events/:id` - WebSocket 实时事件

---

## 扩展建议

如需更复杂的功能，可以：

1. **添加自定义快照**：在工作流图中添加自定义节点和处理逻辑
2. **增加条件断点**：根据状态值在其他地方设置中断点
3. **实现状态版本管理**：扩展 `checkpoint` 包支持多个检查点版本
4. **添加状态验证**：在恢复时验证状态的完整性和一致性

---

## 完整示例

查看 `examples/basic_usage.go` 文件获取完整的使用示例。