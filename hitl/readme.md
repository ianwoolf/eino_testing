# HITL (Human-In-The-Loop) 组件（`hitl`）

## 目标（需求）🎯
- 在工作流运行中，当遇到需要人工确认的步骤（如工具调用）时中断流程，并**保存完整的运行时 state**；
- 支持人工在中断时查看并修改 state（比如工具参数），确认后从上次中断处恢复并继续执行；
- 将修改持久化为 overlay（`.confirm.json`），使进程重启后也能加载并继续。

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
     - 将修改深拷贝到 `pendingState`（内存）并通过 `savePendingState()` 写入 `./checkpoints_data/<id>.confirm.json`（overlay）
     - （best-effort）尝试使用 `updateCheckpointArguments()` 修改官方 checkpoint JSON 以便更快肉眼可见
  4. 继续执行或重启后自动加载 overlay 并注入修改（通过 `compose.WithStateModifier`）

---

## 关键实现点（代码要点）🔧
- `UniversalState`：承载运行时变量，序列化友好（避免直接存 `time.Time`）
- `deepCopyState(s *UniversalState)`：通过 JSON 做深拷贝，确保注入时无共享引用问题
- `savePendingState(baseDir, id, state)` / `loadPendingState(baseDir, id)`：overlay 持久化与加载
- `updateCheckpointArguments(baseDir, id, newArgs)`：best-effort 修改官方 checkpoint JSON 中最后一个 tool call 的 arguments（供人工快速查看）
- 恢复注入：在下一次 `runner.Invoke` 前检测 `pendingState` 或 overlay，若存在则通过 `compose.WithStateModifier` 注入，然后继续执行

---

## 注意事项 & 限制 ⚠️
- `updateCheckpointArguments` 为对 checkpoint JSON 的局部字符串替换，**可能会被框架后续保存覆盖**，不能作为最终一致性保证；推荐使用 overlay (`*.confirm.json`) 做持久化。
- 在注入修改后的 state 时应确保修改数据与预期结构一致，避免导致后续节点解析异常。
- `UniversalState` 中尽量使用基础可序列化类型（string/int/bool/map/array），以避免序列化错误。

---

## 测试与快速上手（Quickstart & Testing）✅

下面包含三个实用部分：
1. **Quickstart（快速上手）** — 快速运行并观察中断/确认/恢复流程；
2. **手动交互示例（Manual flow）** — 演示交互式修改参数并保存 overlay 的具体输入/输出；
3. **端到端自动化测试（E2E）** — 如何运行现有脚本并用 `jq` 验证 checkpoint 内容。

---

### 1) Quickstart（快速上手）
- 构建并运行（本项目包含 `-simulate` 模式以避免外部模型调用，便于测试）：
```bash
cd hitl
go build -o test_hitl .
# 交互测试（在本终端回答提示）
./test_hitl -simulate -checkpoint-id test1
```
- 常用 flags：
  - `-simulate`：不调用外部模型，使用内置的模拟中断/恢复流程（推荐用于 CI 与本地测试）；
  - `-checkpoint-id <id>`：指定检查点 id（默认 `1`）；
  - `-exit-after-confirm`：在保存 overlay 后直接退出，便于人工编辑并重启验证。

预期行为：程序在工具调用前中断，提示 `Are the arguments as expected? (y/n):`；若选择 `n`，输入新的 JSON 参数后会保存为 `./checkpoints_data/<id>.confirm.json`（overlay）。

---

### 2) 手动交互示例（Manual flow）
- 示例交互：
```
Are the arguments as expected? (y/n): n
Please enter the modified arguments: {"location":"Beijing","passenger_name":"Megumin","passenger_phone_number":"2222222"}
Saved confirmation overlay to checkpoints_data/test1.confirm.json and exiting (exit-after-confirm=true)
```
- 行为说明：
  - 保存：修改后的 state 会被深拷贝并写入 `./checkpoints_data/<id>.confirm.json`。
  - 重启：下一次使用相同 `-checkpoint-id` 启动时，程序会优先检测并加载 overlay，然后**清理该 overlay 文件**并继续执行（如本项目实现的 simulate/resume 逻辑）。

快速验证（检查 overlay 是否存在 / 是否被清理）：
```bash
# overlay 是否存在
ls -la checkpoints_data | grep test1.confirm.json
# 运行后查看是否被移除
ls -la checkpoints_data | grep test1.confirm.json || echo "overlay removed"
```
 
---

## 目录与文件（重要）📂
- `main.go`：示例程序入口，包含中断/确认/恢复逻辑
- `store.go`：checkpoint 存储实现（`NewCheckPointStore`）
- `./checkpoints_data/<id>.json`：官方 checkpoint 文件（由 compose 管理）
- `./checkpoints_data/<id>.confirm.json`：人工确认 overlay（新增的持久化层）

---

## 核心特性

### 1. 通用状态管理 (`UniversalState`)

```go
type UniversalState struct {
    MessageHistory   []*schema.Message      // 所有消息历史
    Context          map[string]any         // 通用上下文（支持任意类型）
    NodeExecutionLog map[string]any         // 节点执行日志
    SavedAt          int64                  // 保存时间（UnixNano）
}
```

**优点：**
- ✅ 无需预先定义变量类型，使用 `map[string]any` 存储任意数据
- ✅ 自动保存和恢复所有上下文信息
- ✅ 支持序列化到磁盘（检查点）
- ✅ 完整的执行追踪

### 2. 自动化的 State 管理

每个节点都有 **PreHandler** 和 **PostHandler**：

- **PreHandler**：在节点执行前，保存输入数据到状态
- **PostHandler**：在节点执行后，保存输出数据到状态

这确保了每个节点的完整上下文都被记录。

### 3. 多层级保存机制

#### 消息层面
```
MessageHistory: [User Message] → [AI Response] → [Tool Call] → [Tool Result] → ...
```

#### 执行日志层面
```
NodeExecutionLog: {
    "ChatTemplate": {...},
    "ChatModel_input": {...},
    "ChatModel_output": {...},
    "ToolsNode_input": {...},
    "ToolsNode_output": {...}
}
```

#### 上下文层面
```
Context: {
    "name": "Megumin",
    "location": "Beijing",
    ... (任何其他变量)
}
```

## 工作流程

### 执行阶段

```
┌─────────────────────┐
│   用户输入          │
│ {name, location}    │
└──────────┬──────────┘
           ↓
    ┌──────────────┐
    │ ChatTemplate │ → 保存模板消息
    └──────┬───────┘
           ↓
    ┌─────────────┐
    │  ChatModel  │ → 保存输入/输出消息
    └──────┬──────┘
           ↓
    ┌──────────────────┐
    │ 有工具调用?       │
    └──────┬───────────┘
           ↓
      ┌────────────┐ NO
      │   结束     │ ────→ 返回最终结果
      └────────────┘
           │
           │ YES
           ↓
    ┌──────────────┐
    │  ToolsNode   │ → 🛑 中断点（HITL）
    └──────────────┘
```

### 中断恢复阶段

当流程在 `ToolsNode` 前中断时：

```
1. 提取完整状态信息
   ├─ MessageHistory: 所有消息
   ├─ Context: 所有输入/变量
   └─ NodeExecutionLog: 执行记录

2. 呈现给用户
   ├─ 显示当前上下文
   ├─ 显示消息历史
   └─ 显示待执行的工具调用

3. 用户确认/修改
   └─ 修改工具调用参数（如需）

4. 恢复执行
   └─ 继续 ToolsNode，之后回到 ChatModel
```

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

npm 镜像: `npm config set registry https://registry.npmmirror.com`

### 运行

    go run . --web --web-port 8080


## 使用示例

### 基础使用

```go
// 创建 runner
runner, err := composeGraph[map[string]any, *schema.Message](
    ctx,
    newChatTemplate(ctx),
    newChatModel(ctx),
    newToolsNode(ctx),
    newCheckPointStore(ctx, baseDir),
)

// 执行循环
for {
    result, err := runner.Invoke(ctx, input, compose.WithCheckPointID("1"))
    
    if err == nil {
        // 执行成功
        break
    }
    
    // 提取中断信息
    info, ok := compose.ExtractInterruptInfo(err)
    if !ok {
        log.Fatal(err)
    }
    
    state := info.State.(*UniversalState)
    
    // 访问所有上下文信息
    fmt.Println(state.Context)           // 输入参数
    fmt.Println(state.MessageHistory)    // 消息记录
    fmt.Println(state.NodeExecutionLog)  // 执行日志
    
    // 用户交互...
    
    // 继续执行...
}
```

### 自定义变量存储

```go
// 在任何节点的 PreHandler 中
compose.WithStatePreHandler(func(ctx context.Context, in any, state *UniversalState) (any, error) {
    // 保存自定义变量
    state.Context["my_var"] = some_value
    state.Context["calculation_result"] = compute_something()
    return in, nil
})
```

### 访问保存的信息

```go
// 在中断时
state := info.State.(*UniversalState)

// 获取用户输入
userName := state.Context["name"]

// 获取消息历史
lastMessage := state.MessageHistory[len(state.MessageHistory)-1]

// 获取节点执行日志
toolsNodeInput := state.NodeExecutionLog["ToolsNode_input"]
```

## 检查点存储

状态会自动保存到磁盘：

```
./checkpoints_data/
├── 1.json          # Checkpoint ID "1" 的完整状态快照（由 compose 保存）
├── 1.confirm.json  # 人工确认的 overlay（我们新增的持久化层）
└── ...
```

恢复时自动加载对应的检查点。


## 扩展建议

如需更复杂的功能，可以：

1. **添加自定义快照**：在 `NodeSnapshots` 中保存特定节点的详细信息
2. **增加条件断点**：根据状态值在其他地方设置中断点
3. **实现状态版本管理**：支持多个检查点版本的管理
4. **添加状态验证**：在恢复时验证状态的完整性和一致性
