# HITL UI 优化文档

## 概述

本次优化将 HITL Dashboard 从基础功能界面升级为专业工具风格的 IDE 级界面，优化重点是工作流图可视化效果和整体用户体验。

## 设计原则

1. **专业工具风格** - 参考 VS Code、JetBrains IDE 等专业工具的视觉风格
2. **视觉层次清晰** - 使用颜色、阴影、边框建立明确的信息层次
3. **微交互增强** - 添加过渡动画和状态反馈
4. **高可读性** - 优化对比度和字体排版
5. **模块化设计** - 为后续插件化做好准备

## 主要改进

### 1. 色彩系统升级

#### 主色调
- **背景**: 从 `gray-900` 升级到 `slate-950` 渐变背景
- **卡片**: 使用 `slate-800/50` + `backdrop-blur` 实现毛玻璃效果
- **边框**: 使用 `slate-700/50` 实现半透明边框

#### 状态色优化
```typescript
// 旧方案
pending:   gray-700
running:   blue-600
completed: green-600
interrupted: yellow-600

// 新方案
pending:   slate-800
running:   blue-600 + shadow-blue-500/30
completed: emerald-600 + shadow-emerald-500/30
interrupted: amber-500 + shadow-amber-500/30
```

### 2. WorkflowGraph 组件优化

#### 节点渲染改进
- **阴影效果**: 添加 `drop-shadow` 和发光效果
- **高亮边框**: 选中状态使用蓝色光晕
- **完成标记**: 绿色圆形徽章，带发光效果
- **日志指示器**: 蓝色小圆点，表示有日志可查看

#### 边线优化
- **活跃边线**: 双层渲染，底层 8px 半透明，顶层 3px 实线
- **渐变动画**: 添加平滑过渡效果
- **箭头样式**: 分离 active/inactive 箭头定义

#### 工具调用面板
- **卡片化设计**: 独立卡片展示每个工具调用
- **编辑模式增强**:
  - 黄色边框指示编辑状态
  - 实时 JSON 验证反馈
  - 图标化的提示信息

#### 图例改进
- **视觉增强**: 添加阴影和发光效果
- **分隔线**: 顶部添加分隔线，提升层次感
- **图标化**: 考虑添加图标增强识别度

### 3. Dashboard 主面板优化

#### 头部设计
- **装饰性元素**: 左侧蓝色竖条作为视觉锚点
- **状态徽章**: 编辑模式使用警告色徽章
- **图标化**: 考虑添加图标增强视觉识别

#### 执行列表
- **卡片样式**: 悬停效果提升交互反馈
- **状态徽章**: 使用渐变色提升视觉吸引力
- **选中状态**: 蓝色背景 + 阴影效果

### 4. 其他组件优化

#### MessageHistory
- **图标化消息类型**: 使用 emoji 增强识别度
- **工具调用卡片**: 独立卡片展示
- **可读性优化**: 调整行高和间距

#### StateInspector
- **Tab 切换**: 添加背景容器和平滑过渡
- **空状态**: 添加图标化空状态提示
- **状态展示**: 优化底部状态信息排版

#### CheckpointList
- **图标化头部**: 添加文件夹图标
- **刷新按钮**: 添加旋转图标
- **空状态**: 优化空状态视觉

## 技术细节

### CSS 类命名规范

```typescript
// 背景和边框
bg-slate-800/50              // 半透明背景
backdrop-blur                // 毛玻璃效果
border-slate-700/50          // 半透明边框
shadow-lg                    // 大阴影
shadow-blue-500/25           // 彩色阴影

// 状态色
bg-emerald-600               // 完成状态
bg-blue-600                  // 运行状态
bg-amber-500                 // 中断状态
bg-red-600/80                // 错误状态

// 过渡效果
transition-all               // 所有属性过渡
hover:shadow-blue-500/25     // 悬停阴影
disabled:bg-slate-700        // 禁用状态
```

### 响应式设计

保持现有的响应式布局：
- 移动端: 单列布局
- 平板: 2列布局
- 桌面: 3列布局

## 插件化准备

### 1. 配置系统

建议添加配置对象支持主题定制：

```typescript
interface HITLConfig {
  theme?: {
    primary?: string;
    success?: string;
    warning?: string;
    error?: string;
    background?: string;
  };
  layout?: {
    compact?: boolean;
    showHeader?: boolean;
    showLegend?: boolean;
  };
  features?: {
    realtimeUpdates?: boolean;
    autoScroll?: boolean;
    soundEffects?: boolean;
  };
}
```

### 2. 组件导出

```typescript
// 可以独立导出各个组件供外部使用
export { WorkflowGraph } from './components/WorkflowGraph';
export { MessageHistory } from './components/MessageHistory';
export { StateInspector } from './components/StateInspector';
export { CheckpointList } from './components/CheckpointList';
export { Dashboard } from './pages/Dashboard';
```

### 3. API 抽象

```typescript
// 创建统一的 API 接口便于扩展
interface HITLAPI {
  execute: (params: any) => Promise<ExecutionInfo>;
  resume: (id: string) => Promise<void>;
  getState: (id: string) => Promise<StateResponse>;
  // ...
}

// 支持自定义 API 实现
export function createHITLClient(api: HITLAPI) {
  return api;
}
```

### 4. 事件系统

```typescript
// 添加事件系统支持外部集成
type HITLEvent = 'stateChange' | 'executionStart' | 'executionComplete' | 'error';

interface HITLEvents {
  on(event: HITLEvent, handler: (data: any) => void): void;
  off(event: HITLEvent, handler: (data: any) => void): void;
  emit(event: HITLEvent, data: any): void;
}
```

## 使用示例

### 作为独立应用

```bash
cd hitl/ui
npm install
npm run build
cd ..
go run ./server --web --web-port 8080
```

### 作为嵌入式组件

```tsx
import { Dashboard } from '@eino/hitl-ui';

function App() {
  return (
    <Dashboard
      apiClient={customAPIClient}
      config={{
        theme: { primary: '#3b82f6' },
        layout: { compact: true }
      }}
    />
  );
}
```

## 性能优化

1. **虚拟滚动**: 对于大量数据考虑使用虚拟滚动
2. **懒加载**: 组件按需加载
3. **防抖节流**: 优化实时更新频率
4. **Memo 优化**: 使用 React.memo 减少重渲染

## 未来改进方向

1. **主题切换**: 支持亮色/暗色主题
2. **自定义布局**: 拖拽式面板布局
3. **快捷键支持**: 类似 IDE 的键盘快捷键
4. **导出功能**: 导出工作流图、日志等
5. **国际化**: 支持多语言
6. **无障碍访问**: ARIA 标签和键盘导航

## 文件结构

```
hitl/ui/
├── src/
│   ├── components/          # 可复用组件
│   │   ├── WorkflowGraph.tsx
│   │   ├── MessageHistory.tsx
│   │   ├── StateInspector.tsx
│   │   ├── CheckpointList.tsx
│   │   └── ToolCallConfirm.tsx
│   ├── pages/              # 页面组件
│   │   └── Dashboard.tsx
│   ├── api/                # API 客户端
│   │   ├── client.ts
│   │   ├── types.ts
│   │   └── websocket.ts
│   ├── App.tsx
│   └── main.tsx
└── dist/                   # 构建输出
```

## 构建命令

```bash
# 开发模式
npm run dev

# 生产构建
npm run build

# 预览构建
npm run preview
```

## 相关文档

- [README.md](./readme.md) - HITL 包使用说明
- [REFACTORING.md](./REFACTORING.md) - 重构文档
- [pkg/README.md](./pkg/README.md) - 核心包文档
