# HITL UI - Human In The Loop Web Interface

Web-based UI for the HITL (Human-In-The-Loop) package to visualize and interact with AI agent workflows.

## Features

- **Workflow Visualization**: Interactive graph showing execution flow through ChatTemplate, ChatModel, and ToolsNode
- **Interactive Confirmation**: Approve or reject tool calls with inline JSON editing
- **State Inspection**: View context, message history, and node execution logs
- **Checkpoint Management**: Browse and delete checkpoints
- **Real-time Updates**: WebSocket integration for live state updates
- **Modular Component Library**: Reusable UI components with a consistent design system
- **Modern Technical Design**: Clean, dark-mode optimized interface

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
│   ├── ui/            # Design System Components (Reusable)
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Input.tsx
│   │   ├── StatusIndicator.tsx
│   │   ├── Icon.tsx
│   │   └── index.ts   # UI components export
│   ├── WorkflowGraph.tsx    # Visual node graph
│   ├── StateInspector.tsx   # State viewer
│   ├── CheckpointList.tsx   # Checkpoint manager
│   └── MessageHistory.tsx   # Chat message display
├── pages/
│   └── Dashboard.tsx  # Main dashboard
├── theme/
│   ├── theme.ts      # Design system configuration
│   └── index.ts      # Theme exports
├── styles/
│   └── globals.css   # Global styles
├── App.tsx
└── main.tsx
```

## Using as a Component Library

The HITL UI components are modular and can be imported and used in other projects:

```tsx
// Import design system components
import { Button, Card, Input, StatusBadge, Icons } from './components/ui';
import { theme } from './theme';

// Import feature components
import { WorkflowGraph, StateInspector } from './components';

// Example usage
function MyComponent() {
  return (
    <Card>
      <h3 className={theme.text.primary}>Title</h3>
      <StatusBadge status="completed" />
      <Button variant="primary" onClick={handleClick}>
        <Icons.Plus size="sm" />
        Add New
      </Button>
    </Card>
  );
}
```

### Design System Components

#### Button
```tsx
<Button variant="primary" size="md" loading fullWidth>
  Submit
</Button>
```

**Variants**: `primary`, `secondary`, `success`, `danger`, `warning`
**Sizes**: `sm`, `md`, `lg`

#### Card
```tsx
<Card padding="lg" hoverable>
  <h3>Card Title</h3>
  <p>Card content</p>
</Card>
```

#### StatusBadge
```tsx
<StatusBadge status="completed" />
```

**Status**: `completed`, `error`, `interrupted`, `pending`, `running`

#### Input
```tsx
<Input
  label="Email"
  type="email"
  error="Invalid email format"
  placeholder="user@example.com"
/>
```

#### Icons
```tsx
<Icons.Plus size="md" className="text-blue-400" />
<Icons.Refresh size="sm" className="animate-spin" />
<Icons.Check size="lg" />
```

**Available Icons**: `Plus`, `Refresh`, `Play`, `Check`, `X`, `Edit`, `Trash`, `Close`, `Clipboard`, `Message`, `Chart`, `Box`, `Alert`, `Info`, `Loading`

### Theme System

Access the theme configuration for consistent styling:

```tsx
import { theme, type Status } from './theme';

// Colors
theme.colors.primary[500]      // '#3b82f6'
theme.colors.status.success    // Status styles
theme.colors.background.card   // Card background

// Typography
theme.text.primary             // Primary text color
theme.fontWeight.semibold      // Font weight

// Spacing
theme.spacing.lg               // '1rem'

// Borders
theme.borderRadius.lg          // 'rounded-xl'
theme.border.default           // Default border color
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

## Design Principles

1. **Simplicity**: Clean, uncluttered interface with focus on content
2. **Clarity**: Visual hierarchy guides user attention to important elements
3. **Technical Style**: Dark mode optimized with code-friendly typography
4. **Modularity**: Components are independent and reusable
5. **Accessibility**: WCAG compliant color contrast and keyboard navigation
