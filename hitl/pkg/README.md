# HITL Package Usage Guide

## Overview

The HITL (Human-In-The-Loop) package provides a complete solution for adding human intervention to workflow execution. It supports:

- **Checkpoint Management**: Save and restore workflow state
- **Overlay Persistence**: Save user modifications as overlays
- **Interaction Handling**: Command-line and Web UI interfaces
- **State Management**: Universal state for all context information

## Package Structure

```
hitl/
├── pkg/
│   ├── types/           # Universal state definition
│   ├── checkpoint/      # Checkpoint storage and overlay management
│   ├── graph/          # Workflow graph construction
│   └── interaction/    # User interaction handling
├── cmd/                # Command-line tools
├── server/             # Web server
└── ui/                 # Frontend UI
```

## Quick Start

### 1. Install Dependencies

```bash
go mod download
```

### 2. Basic Usage

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
)

func main() {
    ctx := context.Background()

    // 1. Create checkpoint store
    store := checkpoint.NewStore("./checkpoints_data")

    // 2. Create graph components
    tpl := createChatTemplate(ctx)
    cm := createChatModel(ctx)
    tn := createToolsNode(ctx)

    // 3. Create graph
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

    // 4. Execute with interrupt handling
    input := map[string]any{
        "name":     "Megumin",
        "location": "Beijing",
    }

    for {
        result, err := runner.Invoke(ctx, input, compose.WithCheckPointID("example-1"))
        if err == nil {
            log.Printf("Final result: %s", result.Content)
            return
        }

        // Handle interrupt
        info, ok := compose.ExtractInterruptInfo(err)
        if !ok {
            log.Fatal(err)
        }

        state := info.State.(*types.UniversalState)

        // Display state and handle user confirmation
        interaction.DisplayState(state)
        if err := interaction.HandleToolCalls(state); err != nil {
            log.Fatal(err)
        }

        // Save pending state for resume
        if err := checkpoint.SavePendingState(store.GetBaseDir(), "example-1", state); err != nil {
            log.Printf("Failed to save pending state: %v", err)
        }

        log.Println("Resuming execution...")
    }
}
```

## Core Components

### 1. Checkpoint Management (`pkg/checkpoint`)

#### Store

```go
import "eino_testing/hitl/pkg/checkpoint"

// Create a new checkpoint store
store := checkpoint.NewStore("./checkpoints_data")

// Get checkpoint data
data, exists, err := store.Get(ctx, "checkpoint-id")

// Set checkpoint data
err := store.Set(ctx, "checkpoint-id", data)

// Get base directory
baseDir := store.GetBaseDir()

// Convert to compose.CheckPointStore
composeStore := store.ToComposeStore()
```

#### Overlay Management

```go
import "eino_testing/hitl/pkg/checkpoint"

// Save pending state as overlay
err := checkpoint.SavePendingState(baseDir, "checkpoint-id", state)

// Load pending state from overlay
state, err := checkpoint.LoadPendingState(baseDir, "checkpoint-id")

// Remove overlay
err := checkpoint.RemovePendingState(baseDir, "checkpoint-id")

// Check if overlay exists
exists := checkpoint.HasPendingState(baseDir, "checkpoint-id")

// Update checkpoint arguments
err := checkpoint.UpdateCheckpointArguments(baseDir, "checkpoint-id", newArgs)
```

#### Checkpoint Utilities

```go
import "eino_testing/hitl/pkg/checkpoint"

// List all checkpoints
checkpoints, err := checkpoint.ListCheckpoints(baseDir)
for _, cp := range checkpoints {
    fmt.Printf("ID: %s, Created: %s, Size: %d\n", cp.ID, cp.CreatedAt, cp.Size)
}

// Delete a checkpoint
err := checkpoint.DeleteCheckpoint(baseDir, "checkpoint-id")
```

### 2. Graph Construction (`pkg/graph`)

```go
import "eino_testing/hitl/pkg/graph"

// Create a new graph
runner, err := graph.NewGraph[map[string]any, *schema.Message](ctx, graph.Config{
    ChatTemplate: tpl,
    ChatModel:    cm,
    ToolsNode:    tn,
    CheckPointStore: store.ToComposeStore(),
    InterruptBeforeNodes: []string{"ToolsNode"},
})

// Add individual nodes
err := graph.AddChatTemplateNode(g, tpl)
err := graph.AddChatModelNode(g, cm)
err := graph.AddToolsNode(g, tn)
err := graph.AddEdges(g)
```

### 3. Interaction Handling (`pkg/interaction`)

```go
import "eino_testing/hitl/pkg/interaction"

// Display current state
interaction.DisplayState(state)

// Handle user confirmation
confirmed, err := interaction.HandleUserConfirmation(state)

// Handle tool calls
err := interaction.HandleToolCalls(state)
```

### 4. State Management (`pkg/types`)

```go
import "eino_testing/hitl/pkg/types"

// Create a new universal state
state := types.NewUniversalState()

// Access state fields
messageHistory := state.MessageHistory
context := state.Context
nodeExecutionLog := state.NodeExecutionLog
savedAt := state.SavedAt
```

## Advanced Usage

### Resuming from Checkpoint

```go
// Load pending state
state, err := checkpoint.LoadPendingState(baseDir, "checkpoint-id")
if err != nil {
    log.Fatal(err)
}

// Remove overlay after loading
checkpoint.RemovePendingState(baseDir, "checkpoint-id")

// Resume execution with modified state
result, err := runner.Invoke(ctx, input,
    compose.WithCheckPointID("checkpoint-id"),
    compose.WithStateModifier(func(ctx context.Context, path compose.NodePath, s any) error {
        if st, ok := s.(*types.UniversalState); ok {
            *st = *state
            return nil
        }
        return fmt.Errorf("unexpected state type: %T", s)
    }),
)
```

### Custom Tools

```go
import "github.com/cloudwego/eino/components/tool/utils"

type MyToolInput struct {
    Param1 string `json:"param1"`
    Param2 int    `json:"param2"`
}

myTool, err := utils.InferTool("MyTool", "Tool description",
    func(ctx context.Context, input MyToolInput) (string, error) {
        // Tool implementation
        return "result", nil
    },
)

// Add to tools node
tools := []tool.BaseTool{myTool}
tn, err := compose.NewToolNode(ctx, &compose.ToolsNodeConfig{Tools: tools})
```

### Custom Interrupt Points

```go
// Specify custom interrupt points
runner, err := graph.NewGraph[map[string]any, *schema.Message](ctx, graph.Config{
    ChatTemplate: tpl,
    ChatModel:    cm,
    ToolsNode:    tn,
    CheckPointStore: store.ToComposeStore(),
    InterruptBeforeNodes: []string{"ChatModel", "ToolsNode"},
})
```

## Web Server Usage

```go
import "eino_testing/hitl/server"

// Start web server
err := server.RunServer(8080, "./checkpoints_data", "./ui/dist")
if err != nil {
    log.Fatal(err)
}
```

Access the web UI at `http://localhost:8080`

## API Endpoints

### Execution
- `POST /api/execute` - Start a new execution
- `POST /api/execute/:id/resume` - Resume an execution
- `GET /api/executions` - List all executions
- `GET /api/executions/:id` - Get execution details
- `GET /api/state/:id` - Get current state
- `GET /api/logs/:id` - Get execution logs

### Tool Call Confirmation
- `POST /api/confirm` - Confirm or reject tool calls

### Checkpoints
- `GET /api/checkpoints` - List all checkpoints
- `DELETE /api/checkpoints/:id` - Delete a checkpoint

### WebSocket
- `GET /ws/events/:id` - WebSocket for real-time events

## Configuration

### Environment Variables

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4
OPENAI_BASE_URL=https://api.openai.com/v1
```

### Checkpoint Storage

```go
// Custom checkpoint directory
store := checkpoint.NewStore("/path/to/checkpoints")

// Default directory (./checkpoints_data)
store := checkpoint.NewStore("")
```

## Examples

See `examples/` directory for complete examples:
- `basic_usage.go` - Basic usage example
- `resume_example.go` - Resuming from checkpoint
- `web_server_example.go` - Web server usage

## Migration Guide

### From Old Structure

If you're migrating from the old structure:

1. **Replace imports**:
   ```go
   // Old
   import "eino_testing/hitl"
   
   // New
   import "eino_testing/hitl/pkg/checkpoint"
   import "eino_testing/hitl/pkg/graph"
   import "eino_testing/hitl/pkg/interaction"
   import "eino_testing/hitl/pkg/types"
   ```

2. **Replace function calls**:
   ```go
   // Old
   NewCheckPointStore(ctx, baseDir)
   
   // New
   checkpoint.NewStore(baseDir)
   ```

3. **Update state references**:
   ```go
   // Old
   state := info.State.(*UniversalState)
   
   // New
   state := info.State.(*types.UniversalState)
   ```

## Troubleshooting

### Common Issues

1. **Checkpoint not found**: Ensure the checkpoint ID is correct and the file exists
2. **Overlay not loading**: Check that the overlay file exists and has correct permissions
3. **State type mismatch**: Ensure you're using `*types.UniversalState` consistently
4. **Interrupt not triggered**: Verify that `InterruptBeforeNodes` includes the correct node name

### Debugging

Enable debug logging:

```go
import "log"

log.SetFlags(log.LstdFlags | log.Lshortfile)
log.SetOutput(os.Stdout)
```

## Contributing

When contributing to the HITL package:

1. Follow Go best practices and conventions
2. Add tests for new features
3. Update documentation
4. Ensure backward compatibility when possible

## License

See LICENSE file for details.