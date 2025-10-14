# Development Plan: SVG Serial Plotter with MVC Architecture

## Project Overview
Transform the USB Serial Plotter into a sophisticated SVG rendering application with pan/zoom capabilities, draggable/resizable elements, and strict MVC architecture.

## Architecture Overview

### MVC Pattern
```
┌─────────────────────────────────────────────────────────────┐
│                         MAIN PROCESS                         │
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ SerialDriver  │──│SerialController│──│  SerialModel   │  │
│  │ (Hardware I/O)│  │ (Business Logic)│  │(State Storage) │  │
│  └───────────────┘  └──────────────┘  └─────────────────┘  │
│                            │                    │            │
│                            └────────IPC─────────┘            │
└─────────────────────────────────────────────────────────────┘
                                 │
                                IPC
                                 │
┌─────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ PlotController│──│  PlotModel   │──│   PlotView      │  │
│  │(Business Logic)│  │(State Storage)│  │ (SVG Rendering) │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
│         │                                     │             │
│         └────────────UI Events─────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: Architecture Foundation (Day 1-2)

### 1.1 Directory Structure
```
src/
├── main/
│   ├── main.ts                    # Electron main process entry
│   ├── controllers/
│   │   └── SerialController.ts    # Serial business logic
│   ├── models/
│   │   └── SerialModel.ts         # Serial state management
│   └── drivers/
│       └── SerialDriver.ts        # Hardware serial communication
├── renderer/
│   ├── renderer.ts                # Renderer process entry
│   ├── controllers/
│   │   └── PlotController.ts      # Plot business logic
│   ├── models/
│   │   └── PlotModel.ts           # Plot state management
│   ├── views/
│   │   ├── PlotView.ts            # SVG rendering & interaction
│   │   ├── ControlPanelView.ts    # UI controls rendering
│   │   └── StatusView.ts          # Status display rendering
│   └── utils/
│       ├── SVGRenderer.ts         # SVG manipulation utilities
│       └── Transform.ts           # Pan/zoom transform math
├── preload.ts                     # IPC bridge
└── types/
    ├── plot.types.ts              # Plot-related interfaces
    ├── serial.types.ts            # Serial-related interfaces
    └── ipc.types.ts               # IPC message interfaces
```

### 1.2 Core Type Definitions

**plot.types.ts**
```typescript
export interface Point {
  x: number;
  y: number;
}

export interface SVGElement {
  id: string;
  type: 'path' | 'circle' | 'rect' | 'line' | 'polyline';
  data: string | number[];
  transform: Transform;
  style: SVGStyle;
  draggable: boolean;
  resizable: boolean;
}

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface SVGStyle {
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  opacity?: number;
}

export interface ViewPort {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export interface PlotState {
  elements: SVGElement[];
  viewport: ViewPort;
  selectedElement: string | null;
  gridVisible: boolean;
  gridSize: number;
}
```

**serial.types.ts**
```typescript
export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  vendorId?: string;
  productId?: string;
}

export interface SerialConfig {
  port: string;
  baudRate: number;
  dataBits: 5 | 6 | 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
  flowControl: boolean;
}

export interface SerialState {
  connected: boolean;
  config: SerialConfig | null;
  availablePorts: SerialPortInfo[];
  bytesReceived: number;
  bytesSent: number;
  lastData: string | null;
  error: string | null;
}
```

## Phase 2: Model Layer (Day 2-3)

### 2.1 PlotModel (Renderer)
**Responsibilities:**
- Store all SVG elements and their properties
- Maintain viewport state (pan/zoom)
- Track selection state
- Provide getters/setters with validation
- Emit events on state changes

**Key Methods:**
```typescript
class PlotModel {
  private state: PlotState;
  private listeners: Map<string, Function[]>;
  
  // Element management
  addElement(element: SVGElement): void
  removeElement(id: string): void
  updateElement(id: string, updates: Partial<SVGElement>): void
  getElement(id: string): SVGElement | null
  getAllElements(): SVGElement[]
  
  // Viewport management
  setViewport(viewport: Partial<ViewPort>): void
  getViewport(): ViewPort
  resetViewport(): void
  
  // Selection
  selectElement(id: string | null): void
  getSelectedElement(): SVGElement | null
  
  // Events
  on(event: string, callback: Function): void
  emit(event: string, data?: any): void
}
```

### 2.2 SerialModel (Main Process)
**Responsibilities:**
- Store serial connection state
- Track available ports
- Maintain statistics (bytes sent/received)
- Store configuration

**Key Methods:**
```typescript
class SerialModel {
  private state: SerialState;
  
  // Connection state
  setConnected(connected: boolean): void
  isConnected(): boolean
  
  // Configuration
  setConfig(config: SerialConfig): void
  getConfig(): SerialConfig | null
  
  // Port management
  setAvailablePorts(ports: SerialPortInfo[]): void
  getAvailablePorts(): SerialPortInfo[]
  
  // Statistics
  incrementBytesReceived(count: number): void
  incrementBytesSent(count: number): void
  getStatistics(): { received: number, sent: number }
  
  // Error handling
  setError(error: string | null): void
  getError(): string | null
  
  // Get full state
  getState(): SerialState
}
```

## Phase 3: Driver Layer (Day 3-4)

### 3.1 SerialDriver (Main Process)
**Responsibilities:**
- Direct hardware communication
- Port enumeration
- Connection lifecycle
- Data transmission/reception
- Error handling

**Key Methods:**
```typescript
class SerialDriver {
  private port: SerialPort | null;
  private parser: ReadlineParser | null;
  
  // Port discovery
  async listPorts(): Promise<SerialPortInfo[]>
  
  // Connection
  async connect(config: SerialConfig): Promise<void>
  async disconnect(): Promise<void>
  isConnected(): boolean
  
  // Data I/O
  async write(data: string | Buffer): Promise<void>
  onData(callback: (data: string) => void): void
  removeDataListener(): void
  
  // Error handling
  onError(callback: (error: Error) => void): void
  
  // Cleanup
  destroy(): void
}
```

### 3.2 Test Pattern Generator
**For initial testing without hardware**

```typescript
class TestPatternGenerator {
  private interval: NodeJS.Timer | null;
  
  startCirclePattern(callback: (data: string) => void): void
  startNoisePattern(callback: (data: string) => void): void
  startSineWavePattern(callback: (data: string) => void): void
  stop(): void
}
```

## Phase 4: Controller Layer (Day 4-5)

### 4.1 PlotController (Renderer)
**Responsibilities:**
- Handle user interactions (click, drag, zoom)
- Coordinate between PlotModel and PlotView
- Implement business logic for plot operations
- Transform user input to model updates

**Key Methods:**
```typescript
class PlotController {
  constructor(
    private model: PlotModel,
    private view: PlotView
  ) {}
  
  // Element operations
  createCircle(center: Point, radius: number): void
  createPath(points: Point[]): void
  deleteSelected(): void
  
  // Transform operations
  startDrag(elementId: string, startPoint: Point): void
  drag(currentPoint: Point): void
  endDrag(): void
  
  startResize(elementId: string, handle: string, startPoint: Point): void
  resize(currentPoint: Point): void
  endResize(): void
  
  // Viewport operations
  pan(delta: Point): void
  zoom(factor: number, center?: Point): void
  resetView(): void
  
  // Selection
  selectElementAt(point: Point): void
  clearSelection(): void
  
  // Grid
  toggleGrid(): void
  setGridSize(size: number): void
  
  // Test pattern
  generateTestPattern(type: 'circle' | 'noise' | 'sine'): void
}
```

### 4.2 SerialController (Main Process)
**Responsibilities:**
- Coordinate SerialDriver and SerialModel
- Handle connection lifecycle
- Process incoming data
- Manage IPC communication with renderer

**Key Methods:**
```typescript
class SerialController {
  constructor(
    private driver: SerialDriver,
    private model: SerialModel,
    private mainWindow: BrowserWindow
  ) {}
  
  // Port operations
  async refreshPorts(): Promise<SerialPortInfo[]>
  
  // Connection
  async connect(config: SerialConfig): Promise<void>
  async disconnect(): Promise<void>
  
  // Data handling
  private handleData(data: string): void
  async sendData(data: string): Promise<void>
  
  // Test mode
  startTestPattern(type: string): void
  stopTestPattern(): void
  
  // State sync
  private syncStateToRenderer(): void
}
```

## Phase 5: View Layer (Day 5-7)

### 5.1 PlotView (Renderer)
**Responsibilities:**
- Render SVG elements to canvas/SVG DOM
- Handle visual updates only
- Provide event callbacks (no business logic)
- Implement smooth animations

**Key Methods:**
```typescript
class PlotView {
  private container: SVGSVGElement;
  private defs: SVGDefsElement;
  private mainGroup: SVGGElement;
  private gridGroup: SVGGElement;
  
  // Setup
  initialize(containerId: string): void
  
  // Rendering
  render(state: PlotState): void
  renderElement(element: SVGElement): SVGElement
  updateElement(id: string, element: SVGElement): void
  removeElement(id: string): void
  
  // Viewport
  applyViewport(viewport: ViewPort): void
  
  // Grid
  renderGrid(viewport: ViewPort, gridSize: number): void
  
  // Selection
  highlightElement(id: string): void
  clearHighlight(): void
  
  // Resize handles
  showResizeHandles(id: string): void
  hideResizeHandles(): void
  
  // Event binding
  onElementClick(callback: (id: string, point: Point) => void): void
  onElementDragStart(callback: (id: string, point: Point) => void): void
  onElementDrag(callback: (point: Point) => void): void
  onElementDragEnd(callback: () => void): void
  
  onCanvasPan(callback: (delta: Point) => void): void
  onCanvasZoom(callback: (factor: number, center: Point) => void): void
  
  // Utilities
  screenToWorld(screen: Point): Point
  worldToScreen(world: Point): Point
}
```

### 5.2 ControlPanelView (Renderer)
**Responsibilities:**
- Render connection controls
- Render plot settings
- Handle UI interactions (delegate to controllers)

### 5.3 StatusView (Renderer)
**Responsibilities:**
- Display connection status
- Show statistics
- Display errors/warnings

## Phase 6: Integration & IPC (Day 7-8)

### 6.1 IPC Message Types
```typescript
// Renderer -> Main
export type IPCRequest = 
  | { type: 'serial:list-ports' }
  | { type: 'serial:connect', payload: SerialConfig }
  | { type: 'serial:disconnect' }
  | { type: 'serial:send', payload: string }
  | { type: 'serial:start-test', payload: string }
  | { type: 'serial:stop-test' }

// Main -> Renderer
export type IPCEvent =
  | { type: 'serial:data', payload: string }
  | { type: 'serial:state-changed', payload: SerialState }
  | { type: 'serial:error', payload: string }
```

### 6.2 Preload Bridge
Update `preload.ts` with comprehensive API

### 6.3 Auto-connect on Load
```typescript
// In renderer initialization
async function init() {
  // Initialize MVC
  const plotModel = new PlotModel();
  const plotView = new PlotView();
  const plotController = new PlotController(plotModel, plotView);
  
  // Initialize view
  plotView.initialize('plot-canvas');
  
  // Generate test pattern
  plotController.generateTestPattern('circle');
  
  // Auto-connect to first available port
  const ports = await window.electronAPI.listPorts();
  if (ports.length > 0) {
    await window.electronAPI.connect({
      port: ports[0].path,
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: false
    });
    
    // Start test pattern from serial
    await window.electronAPI.startTestPattern('circle');
  }
}
```

## Phase 7: SVG Interaction Features (Day 8-10)

### 7.1 Pan & Zoom
**Implementation:**
- Mouse wheel for zoom (with center point)
- Middle-mouse or space+drag for pan
- Zoom limits (min/max)
- Smooth animations using requestAnimationFrame

### 7.2 Drag & Drop
**Implementation:**
- Click to select
- Drag selected element
- Snap to grid (optional)
- Ghost preview during drag
- Update transform in model

### 7.3 Resize Handles
**Implementation:**
- Show 8 handles on selected element (corners + edges)
- Drag handles to resize
- Maintain aspect ratio (shift key)
- Update transform in model

### 7.4 Selection System
**Implementation:**
- Click to select
- Box selection (drag on empty space)
- Multi-select (ctrl/cmd key)
- Selection outline
- Keyboard shortcuts (delete, esc)

## Phase 8: Advanced Features (Day 10-12)

### 8.1 Performance Optimization
- Virtual rendering (only render visible elements)
- Canvas-based rendering for large datasets
- Throttle/debounce user input
- Web Workers for data processing

### 8.2 Data Streaming from Serial
- Parse incoming serial data as SVG commands
- Support for incremental SVG building
- Buffer management
- Real-time updates

### 8.3 Export/Import
- Export current plot as SVG file
- Import SVG files
- Save/load plot state

## Testing Strategy

### Unit Tests
- Model classes (state management)
- Transform utilities (math)
- Data parsing

### Integration Tests
- Controller coordination
- IPC communication
- Serial driver with mock port

### Manual Testing
- Test with real serial device
- Performance with large SVGs
- Pan/zoom smoothness
- Drag/resize accuracy

## Implementation Order (Priority)

1. **Phase 1**: Directory structure + type definitions (Day 1)
2. **Phase 2**: PlotModel + SerialModel (Day 2)
3. **Phase 3**: SerialDriver + TestPatternGenerator (Day 3)
4. **Phase 4**: Controllers (Day 4-5)
5. **Phase 5**: PlotView with basic rendering (Day 5-6)
6. **Phase 6**: IPC + Auto-connect (Day 7)
7. **Phase 7**: Pan/Zoom first, then Drag/Resize (Day 8-9)
8. **Phase 8**: Polish + optimization (Day 10-12)

## Dependencies to Add

```json
{
  "dependencies": {
    "@types/d3": "^7.4.0",
    "d3": "^7.8.0"  // For transform math and SVG manipulation
  }
}
```

## Success Criteria

- [ ] SVG elements render correctly
- [ ] Pan and zoom work smoothly (60fps)
- [ ] Elements are draggable with visual feedback
- [ ] Elements are resizable with handles
- [ ] Auto-connect on load with test pattern
- [ ] Strict MVC separation (no business logic in views)
- [ ] Serial data can update plot in real-time
- [ ] Clean code with TypeScript types
- [ ] No security violations (context isolation maintained)

## Next Steps

1. Create directory structure
2. Define all TypeScript interfaces
3. Implement PlotModel
4. Implement basic PlotView with static SVG
5. Add pan/zoom to PlotView
6. Connect PlotController
7. Implement SerialDriver with test pattern
8. Add auto-connect logic
9. Implement drag/resize
10. Polish and optimize

---

**Estimated Timeline:** 10-12 days
**Current Phase:** Ready to begin Phase 1

