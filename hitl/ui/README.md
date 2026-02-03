# HITL UI - Human In The Loop Web Interface

Web-based UI for the HITL (Human-In-The-Loop) package to visualize and interact with AI agent workflows.

## Features

- **Workflow Visualization**: Interactive graph showing execution flow through ChatTemplate, ChatModel, and ToolsNode
- **Interactive Confirmation**: Approve or reject tool calls with inline JSON editing
- **State Inspection**: View context, message history, and node execution logs
- **Checkpoint Management**: Browse and delete checkpoints
- **Real-time Updates**: WebSocket integration for live state updates

## Development

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Technology Stack

- **Vite** - Fast build tool and dev server
- **React 18** - UI framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **React Query** - API state management (via @tanstack/react-query)

## Project Structure

```
src/
├── api/
│   ├── client.ts      # API client with fetch
│   ├── websocket.ts   # WebSocket client
│   └── types.ts       # TypeScript types
├── components/
│   ├── WorkflowGraph.tsx    # Visual node graph
│   ├── StateInspector.tsx   # State viewer
│   ├── ToolCallConfirm.tsx  # Confirmation dialog
│   ├── CheckpointList.tsx   # Checkpoint manager
│   └── MessageHistory.tsx   # Chat message display
├── pages/
│   └── Dashboard.tsx  # Main dashboard
├── styles/
│   └── globals.css    # Global styles
├── App.tsx
└── main.tsx
```

## API Integration

The UI connects to the Go web server running on port 8080 (configurable via `VITE_API_URL`).

### Endpoints

- `POST /api/execute` - Start new execution
- `POST /api/execute/:id/resume` - Resume from checkpoint
- `GET /api/state/:id` - Get current state
- `POST /api/confirm` - Submit tool call confirmation
- `GET /api/checkpoints` - List checkpoints
- `DELETE /api/checkpoints/:id` - Delete checkpoint
- `WS /ws/events/:id` - Real-time state updates
