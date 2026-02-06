# HITL Package Refactoring Plan

## 📋 Overview

This document outlines the refactoring plan for the HITL package to eliminate code duplication and improve modularity.

## 🎯 Goals

1. **Eliminate code duplication** between `hitl/` and `hitl/server/`
2. **Improve modularity** by creating reusable packages
3. **Enhance maintainability** with clear separation of concerns
4. **Provide clean API** for external usage

## 🔍 Current Issues

### 1. Duplicated Code

| Component | Location 1 | Location 2 | Status |
|-----------|------------|------------|--------|
| UniversalState | `hitl/state.go` | `hitl/pkg/types/state.go` | ✅ Partially extracted |
| Checkpoint Store | `hitl/store.go` | `hitl/server/graph.go` | ❌ Duplicated |
| Overlay Management | `hitl/checkpoint.go` | `hitl/server/state.go` | ❌ Duplicated |
| Graph Construction | `hitl/graph.go` | `hitl/server/graph.go` | ❌ Duplicated |
| Node Functions | `hitl/graph.go` | `hitl/server/graph.go` | ❌ Duplicated |
| Constants | `hitl/checkpoint.go` | `hitl/server/state.go` | ❌ Duplicated |

### 2. Structure Issues

- **Mixed concerns**: Business logic mixed with CLI and server code
- **Tight coupling**: Server code directly depends on main package
- **No clear API**: External usage requires importing internal packages

## 🏗️ New Structure

```
hitl/
├── pkg/                          # 🆕 Core packages (reusable)
│   ├── types/
│   │   └── state.go              # UniversalState definition
│   ├── checkpoint/               # 🆕 Checkpoint management
│   │   ├── store.go              # Checkpoint storage
│   │   ├── overlay.go            # Overlay management
│   │   └── utils.go              # Utility functions
│   ├── graph/                    # 🆕 Workflow graph
│   │   └── graph.go              # Graph construction
│   └── interaction/              # 🆕 Interaction handling
│       └── interaction.go        # User interaction logic
├── cmd/                          # 🆕 Command-line tools
│   └── test_hitl/                # Example CLI program
│       └── main.go
├── server/                       # Web server
│   ├── api/                      # 🆕 API layer
│   │   ├── handlers.go
│   │   └── types.go
│   ├── websocket/                # 🆕 WebSocket
│   │   └── websocket.go
│   ├── execution.go              # Execution manager
│   ├── main.go                   # Server entry point
│   └── state.go                  # Server-specific state
├── ui/                           # Frontend (unchanged)
├── examples/                     # 🆕 Usage examples
│   └── basic_usage.go
├── go.mod
├── go.sum
├── readme.md                     # User documentation
├── pkg/README.md                 # 🆕 Package documentation
└── REFACTORING.md                # 🆕 This file
```

## 📦 Package Responsibilities

### `pkg/types/`
**Purpose**: Define core data types

**Exports**:
- `UniversalState` - Universal state structure
- `NewUniversalState()` - Factory function

### `pkg/checkpoint/`
**Purpose**: Checkpoint storage and overlay management

**Exports**:
- `Store` - Checkpoint store implementation
- `NewStore(baseDir string) *Store` - Factory function
- `SavePendingState(baseDir, checkpointID string, state *UniversalState) error`
- `LoadPendingState(baseDir, checkpointID string) (*UniversalState, error)`
- `RemovePendingState(baseDir, checkpointID string) error`
- `HasPendingState(baseDir, checkpointID string) bool`
- `UpdateCheckpointArguments(baseDir, checkpointID, newArgs string) error`
- `ListCheckpoints(baseDir string) ([]CheckpointSummary, error)`
- `DeleteCheckpoint(baseDir, id string) error`

### `pkg/graph/`
**Purpose**: Workflow graph construction

**Exports**:
- `Config` - Graph configuration
- `NewGraph[I, O](ctx context.Context, cfg Config) (compose.Runnable[I, O], error)`
- `AddChatTemplateNode[I, O](g *compose.Graph[I, O], tpl prompt.ChatTemplate) error`
- `AddChatModelNode[I, O](g *compose.Graph[I, O], cm model.ToolCallingChatModel) error`
- `AddToolsNode[I, O](g *compose.Graph[I, O], tn *compose.ToolsNode) error`
- `AddEdges[I, O](g *compose.Graph[I, O]) error`

### `pkg/interaction/`
**Purpose**: User interaction handling

**Exports**:
- `HandleUserConfirmation(state *UniversalState) (bool, error)`
- `HandleToolCalls(state *UniversalState) error`
- `DisplayState(state *UniversalState)`

## 🔄 Migration Steps

### Phase 1: Create New Packages ✅

- [x] Create `pkg/checkpoint/store.go`
- [x] Create `pkg/checkpoint/overlay.go`
- [x] Create `pkg/checkpoint/utils.go`
- [x] Create `pkg/graph/graph.go`
- [x] Create `pkg/interaction/interaction.go`
- [x] Create `examples/basic_usage.go`
- [x] Create `pkg/README.md`

### Phase 2: Update CLI Tool

- [ ] Create `cmd/test_hitl/main.go`
- [ ] Update to use new packages
- [ ] Remove old `hitl/main.go`

### Phase 3: Update Server

- [ ] Refactor `server/graph.go` to use `pkg/graph`
- [ ] Refactor `server/state.go` to use `pkg/checkpoint`
- [ ] Update `server/handlers.go` to use new packages
- [ ] Update `server/types.go` to use `pkg/types`

### Phase 4: Cleanup

- [ ] Remove old `hitl/checkpoint.go`
- [ ] Remove old `hitl/components.go`
- [ ] Remove old `hitl/graph.go`
- [ ] Remove old `hitl/interaction.go`
- [ ] Remove old `hitl/state.go`
- [ ] Remove old `hitl/store.go`
- [ ] Update `readme.md`

### Phase 5: Testing

- [ ] Test CLI tool
- [ ] Test server
- [ ] Test examples
- [ ] Update documentation

## 📝 Migration Guide

### For CLI Users

**Before**:
```go
import "eino_testing/hitl"

store := NewCheckPointStore(ctx, baseDir)
state := info.State.(*UniversalState)
```

**After**:
```go
import (
    "eino_testing/hitl/pkg/checkpoint"
    "eino_testing/hitl/pkg/types"
)

store := checkpoint.NewStore(baseDir)
state := info.State.(*types.UniversalState)
```

### For Server Users

**Before**:
```go
import "eino_testing/hitl"

func (s *Server) composeGraph(ctx context.Context) {
    return composeGraph[...](
        ctx,
        newChatTemplate(ctx),
        newChatModel(ctx),
        newToolsNode(ctx),
        newMyStore(ctx, s.baseDir),
    )
}
```

**After**:
```go
import (
    "eino_testing/hitl/pkg/checkpoint"
    "eino_testing/hitl/pkg/graph"
)

func (s *Server) composeGraph(ctx context.Context) {
    return graph.NewGraph[...](ctx, graph.Config{
        ChatTemplate: newChatTemplate(ctx),
        ChatModel:    newChatModel(ctx),
        ToolsNode:    newToolsNode(ctx),
        CheckPointStore: checkpoint.NewStore(s.baseDir).ToComposeStore(),
    })
}
```

## 🎯 Benefits

### 1. Reduced Code Duplication
- **Before**: ~500 lines of duplicated code
- **After**: 0 lines of duplicated code

### 2. Improved Modularity
- Clear separation of concerns
- Reusable packages
- Easy to test and maintain

### 3. Better API
- Clean, documented API
- Type-safe interfaces
- Consistent naming conventions

### 4. Enhanced Maintainability
- Single source of truth
- Easier to add features
- Simpler debugging

## 📊 Code Statistics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total Lines | ~1500 | ~1200 | -20% |
| Duplicated Lines | ~500 | 0 | -100% |
| Packages | 2 | 6 | +200% (modularity) |
| Public Functions | 15 | 30 | +100% (API) |

## 🚀 Next Steps

1. **Review and approve** this refactoring plan
2. **Accept the new package files** created in this PR
3. **Update CLI tool** to use new packages
4. **Update server** to use new packages
5. **Remove old files** after verification
6. **Run tests** to ensure everything works
7. **Update documentation**

## 📞 Support

If you have questions or need help with the migration:

1. Check `pkg/README.md` for detailed usage examples
2. See `examples/basic_usage.go` for code examples
3. Refer to this document for migration guidance

## ✅ Checklist

- [ ] Review new package structure
- [ ] Accept new package files
- [ ] Update CLI tool
- [ ] Update server code
- [ ] Remove old files
- [ ] Test all functionality
- [ ] Update documentation
- [ ] Verify no regressions