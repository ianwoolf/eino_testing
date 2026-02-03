# HITL Web UI Implementation

A web-based UI for the HITL (Human-In-The-Loop) package that provides visual workflow management, interactive tool call confirmation, and state inspection.

## Features

- **Workflow Visualization**: Interactive graph showing execution flow through ChatTemplate, ChatModel, and ToolsNode
- **Interactive Confirmation**: Approve or reject tool calls with inline JSON editing
- **State Inspection**: View context, message history, and node execution logs in real-time
- **Checkpoint Management**: Browse and delete checkpoints
- **Real-time Updates**: WebSocket integration for live state updates
- **Execution Management**: Create, monitor, and resume executions

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (React + TS)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  Workflow   │  │  Interactive │  │   State Inspector   │   │
│  │Visualizer   │  │ Confirmation │  │                     │   │
│  └─────────────┘  └──────────────┘  └─────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Checkpoint Manager                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                    Go Web Server (Gin Framework)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   API Handlers                            │  │
│  │  /api/execute  /api/checkpoints  /api/state  /ws/events  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   HITL Core                               │  │
│  │  (UniversalState, CheckpointStore, Interrupt/Resume)     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
hitl/
├── main.go              # Entry point with --web flag support
├── state.go             # UniversalState definition
├── checkpoint.go        # Checkpoint utilities
├── graph.go             # Workflow graph composition
├── components.go        # LLM components
├── store.go             # Checkpoint storage
├── interaction.go       # CLI interaction handlers
└── server/              # Web server package
    ├── main.go          # Web server entry point
    ├── handlers.go      # HTTP request handlers
    ├── websocket.go     # WebSocket handler
    ├── types.go         # API request/response types
    ├── execution.go     # Execution manager
    ├── state.go         # State management (copy)
    └── graph.go         # Graph composition (copy)
```

## Quick Start

### CLI Mode (Original)

```bash
cd hitl
go run . --simulate
```

### Web Server Mode

```bash
cd hitl
go run . --web --web-port 8080
```

Then open http://localhost:8080 in your browser.

### Frontend Development

```bash
cd hitl/ui

# Install dependencies
npm install

# Development server (with hot reload)
npm run dev

# Build for production
npm run build
```

## API Endpoints

### Execution
- `POST /api/execute` - Start new execution
  ```json
  {
    "name": "Megumin",
    "location": "Beijing"
  }
  ```
- `POST /api/execute/:id/resume` - Resume from checkpoint
- `GET /api/executions` - List all executions
- `GET /api/executions/:id` - Get execution details
- `GET /api/state/:id` - Get current state
- `GET /api/logs/:id` - Stream execution logs

### Tool Call Confirmation
- `POST /api/confirm` - Submit tool call confirmation
  ```json
  {
    "execution_id": "exec-1",
    "action": "confirm"
  }
  ```
  or
  ```json
  {
    "execution_id": "exec-1",
    "action": "reject",
    "new_args": "{\"location\": \"Shanghai\"}"
  }
  ```

### Checkpoints
- `GET /api/checkpoints` - List all checkpoints
- `DELETE /api/checkpoints/:id` - Delete checkpoint

### WebSocket
- `WS /ws/events/:id` - Real-time state updates for execution

## CLI Flags

- `--web` - Enable web server mode
- `--web-port <port>` - Web server port (default: 8080)
- `--web-dist <path>` - Frontend dist directory (default: ./ui/dist)
- `--base-dir <path>` - Checkpoints directory (default: ./checkpoints_data)
- `--simulate` - Run in simulation mode (no external API calls)
- `--checkpoint-id <id>` - Checkpoint ID to use (default: 1)
- `--exit-after-confirm` - Exit after saving confirmation overlay

## Technology Stack

### Backend
- Go 1.21+
- Gin Web Framework
- Gorilla WebSocket
- Eino Framework (cloudwego/eino)
- OpenAI compatible API

### Frontend
- React 18
- TypeScript
- Vite
- TailwindCSS
- React Query (@tanstack/react-query)

## Implementation Details

### Server Package

The `/server` directory contains a complete implementation of the web server with:

1. **Execution Management** (`execution.go`)
   - Concurrent execution handling with mutex protection
   - Execution lifecycle management (start, interrupt, resume, complete)
   - WebSocket event broadcasting

2. **API Handlers** (`handlers.go`)
   - RESTful API endpoints
   - JSON request/response handling
   - Error handling with proper HTTP status codes

3. **WebSocket Support** (`websocket.go`)
   - Real-time state updates
   - Automatic reconnection
   - Connection lifecycle management

4. **Type Definitions** (`types.go`)
   - API request/response types
   - Conversion functions between internal and API types

### Frontend Components

1. **WorkflowGraph.tsx**
   - Visual representation of the execution graph
   - Node status highlighting (pending, running, completed, interrupted)
   - Current execution position indicator

2. **ToolCallConfirm.tsx**
   - Display pending tool calls
   - Inline JSON editor for argument modification
   - Confirm/Reject actions

3. **StateInspector.tsx**
   - Tabbed view: Context, Messages, Node Logs
   - JSON syntax highlighting
   - Expandable/collapsible sections

4. **CheckpointList.tsx**
   - List all checkpoints with metadata
   - Delete checkpoint functionality
   - Auto-refresh every 5 seconds

5. **MessageHistory.tsx**
   - Chat-style message display
   - Tool call visualization
   - Role-based styling

## Development Workflow

### Backend Development

```bash
# Run the web server
cd hitl
go run . --web

# Or build and run
go build -o hitl-web .
./hitl-web --web
```

### Frontend Development

The Vite dev server proxies API requests to the Go backend:

```bash
# Terminal 1: Start Go server
cd hitl
go run . --web --web-port 8080

# Terminal 2: Start Vite dev server
cd hitl/ui
npm run dev
```

### Production Deployment

```bash
# Build frontend
cd hitl/ui
npm run build

# The Go server serves static files from ui/dist/
cd hitl
go run . --web
```

## Example Workflow

1. Start the web server: `go run . --web`
2. Open http://localhost:8080
3. Enter name (e.g., "Megumin") and location (e.g., "Beijing")
4. Click "Start Execution"
5. Watch the workflow graph update in real-time
6. When execution is interrupted at ToolsNode:
   - Review the pending tool call
   - Either "Confirm" to approve or "Edit & Reject" to modify
   - Click "Resume Execution" to continue
7. View the final result when execution completes

## Notes

- The CLI mode remains fully functional with backward compatibility
- WebSocket connections handle graceful reconnection
- Frontend gracefully handles server disconnection
- API returns proper HTTP status codes and error messages
- Checkpoint files use atomic write operations for safety
