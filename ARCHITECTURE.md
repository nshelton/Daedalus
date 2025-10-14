# Architecture Reference

## MVC Component Interaction Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MAIN PROCESS (Node.js)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ SerialDriver (Hardware Layer)                                     │  │
│  │ - Manages SerialPort instance                                     │  │
│  │ - Handles low-level I/O                                           │  │
│  │ - Emits raw data events                                           │  │
│  └────────────────────┬─────────────────────────────────────────────┘  │
│                       │                                                  │
│                       │ (uses)                                           │
│                       ▼                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ SerialController (Business Logic)                                 │  │
│  │ - Connection lifecycle management                                 │  │
│  │ - Data processing & validation                                    │  │
│  │ - Test pattern generation                                         │  │
│  │ - Coordinates Driver & Model                                      │  │
│  └────────────────────┬─────────────────────────────────────────────┘  │
│                       │                                                  │
│                       │ (updates)                                        │
│                       ▼                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ SerialModel (State Storage)                                       │  │
│  │ - Connection state                                                │  │
│  │ - Port configuration                                              │  │
│  │ - Statistics (bytes sent/received)                                │  │
│  │ - Error state                                                     │  │
│  └────────────────────┬─────────────────────────────────────────────┘  │
│                       │                                                  │
└───────────────────────┼──────────────────────────────────────────────────┘
                        │
                        │ IPC (via preload.ts)
                        │
┌───────────────────────┼──────────────────────────────────────────────────┐
│                       │           RENDERER PROCESS (Browser)             │
├───────────────────────┼──────────────────────────────────────────────────┤
│                       │                                                  │
│                       ▼                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ UI Layer (HTML/Events)                                            │  │
│  │ - User clicks, drags, zooms                                       │  │
│  │ - Button clicks, form inputs                                      │  │
│  └────────────────────┬─────────────────────────────────────────────┘  │
│                       │                                                  │
│                       │ (events)                                         │
│                       ▼                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ PlotController (Business Logic)                                  │     │
│  │ - Handle user interactions                                       │  │
│  │ - Transform input to model operations                            │  │
│  │ - Coordinate Model & View                                        │  │
│  │ - Implement drag/resize/pan/zoom logic                           │  │
│  └─────┬────────────────────────────────────────────────────┬───────┘     │
│        │                                                     │            │
│        │ (updates)                                           │ (renders)  │
│        ▼                                                     ▼            │
│  ┌──────────────────┐                              ┌──────────────────┐   │
│  │ PlotModel        │                              │ PlotView         │   │
│  │ - SVG elements   │◄─────(reads)─────────────────│ - SVG rendering  │   │
│  │ - Viewport state │                              │ - Visual updates │   │
│  │ - Selection      │                              │ - Event binding  │   │
│  │ - Grid settings  │                              │ - Animations     │   │  
│  └──────────────────┘                              └──────────────────┘   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Examples

### Example 1: User Drags an SVG Element

```
1. User Mouse Down on Element
   PlotView.onElementDragStart() 
   ↓
   PlotController.startDrag(elementId, point)
   ↓
   PlotController stores drag state internally

2. User Mouse Move
   PlotView.onElementDrag()
   ↓
   PlotController.drag(currentPoint)
   ↓
   PlotController calculates new position
   ↓
   PlotModel.updateElement(id, { transform: {...} })
   ↓
   PlotModel.emit('element-updated', element)
   ↓
   PlotController listens to model event
   ↓
   PlotView.updateElement(id, element)
   ↓
   SVG DOM updated (visual feedback)

3. User Mouse Up
   PlotView.onElementDragEnd()
   ↓
   PlotController.endDrag()
   ↓
   PlotController clears drag state
```

### Example 2: Pan the Viewport

```
1. User Middle-Mouse Drag or Space+Drag
   PlotView.onCanvasPan()
   ↓
   PlotController.pan(delta)
   ↓
   PlotModel.setViewport({ x: ..., y: ... })
   ↓
   PlotModel.emit('viewport-changed', viewport)
   ↓
   PlotView.applyViewport(viewport)
   ↓
   SVG transform applied (visual pan)
```

### Example 3: Zoom with Mouse Wheel

```
1. User Scrolls Mouse Wheel
   PlotView.onCanvasZoom()
   ↓
   PlotController.zoom(factor, centerPoint)
   ↓
   PlotController calculates new viewport with zoom
   ↓
   PlotModel.setViewport({ zoom: ..., x: ..., y: ... })
   ↓
   PlotModel.emit('viewport-changed', viewport)
   ↓
   PlotView.applyViewport(viewport)
   ↓
   SVG transform applied (visual zoom)
```

### Example 4: Serial Data Updates Plot

```
1. Serial Device Sends Data
   SerialDriver receives data
   ↓
   SerialDriver.onData callback
   ↓
   SerialController.handleData(data)
   ↓
   SerialController parses data
   ↓
   SerialModel.incrementBytesReceived()
   ↓
   SerialController sends to renderer via IPC
   ↓
   mainWindow.webContents.send('serial:data', data)

2. Renderer Receives Data
   window.electronAPI.onSerialData(callback)
   ↓
   PlotController.handleSerialData(data)
   ↓
   PlotController parses SVG commands
   ↓
   PlotModel.addElement(svgElement)
   ↓
   PlotModel.emit('element-added', element)
   ↓
   PlotView.renderElement(element)
   ↓
   New SVG element appears on screen
```

### Example 5: Auto-Connect on Load with Test Pattern

```
1. App Starts
   renderer.ts init()
   ↓
   Create PlotModel, PlotView, PlotController
   ↓
   PlotController.generateTestPattern('circle')
   ↓
   PlotModel.addElement(circleElement)
   ↓
   PlotView.renderElement(circleElement)

2. Request Serial Ports
   window.electronAPI.listPorts()
   ↓
   IPC to Main Process
   ↓
   SerialController.refreshPorts()
   ↓
   SerialDriver.listPorts()
   ↓
   Return ports to renderer

3. Auto-Connect
   window.electronAPI.connect(config)
   ↓
   IPC to Main Process
   ↓
   SerialController.connect(config)
   ↓
   SerialDriver.connect(config)
   ↓
   SerialModel.setConnected(true)
   ↓
   Sync state to renderer

4. Start Test Pattern
   window.electronAPI.startTestPattern('circle')
   ↓
   IPC to Main Process
   ↓
   SerialController.startTestPattern('circle')
   ↓
   TestPatternGenerator.startCirclePattern()
   ↓
   Periodically send data via IPC
   ↓
   Renderer updates plot (see Example 4)
```

## Key Principles

### Separation of Concerns

1. **Models** - Only store state, no business logic
   - Provide getters/setters with validation
   - Emit events when state changes
   - No direct DOM manipulation
   - No network/IPC calls

2. **Views** - Only render, no business logic
   - Read from models
   - Bind DOM events
   - Call controller methods
   - No direct model updates (except via controller)
   - No computation/validation

3. **Controllers** - All business logic
   - Handle user interactions
   - Update models
   - Trigger view updates
   - Coordinate between model and view
   - All computation/validation here

4. **Drivers** - Hardware/external interface
   - Direct hardware communication only
   - No business logic
   - Raw data in/out
   - Emit events for controllers to handle

### Event Flow Rules

1. **User Input**: `View → Controller → Model → View`
2. **External Input**: `Driver → Controller → Model → View`
3. **Never**: `View → Model` (always go through controller)
4. **Never**: `Driver → Model` (always go through controller)

### IPC Boundaries

- **Main Process**: Serial I/O, file system, hardware access
- **Renderer Process**: UI, plotting, user interaction
- **Communication**: Async IPC only, no synchronous calls
- **Security**: Context isolation always enabled

## File Responsibilities

### Main Process

| File | Responsibility | Dependencies |
|------|----------------|--------------|
| `main.ts` | App initialization, window creation, IPC setup | electron |
| `SerialDriver.ts` | Hardware serial communication | serialport |
| `SerialController.ts` | Serial business logic | Driver, Model |
| `SerialModel.ts` | Serial state storage | none |

### Renderer Process

| File | Responsibility | Dependencies |
|------|----------------|--------------|
| `renderer.ts` | UI initialization, MVC setup | All renderer files |
| `PlotController.ts` | Plot business logic | Model, View |
| `PlotModel.ts` | Plot state storage | none |
| `PlotView.ts` | SVG rendering and interaction | d3 or vanilla SVG |
| `ControlPanelView.ts` | UI controls rendering | none |
| `StatusView.ts` | Status display rendering | none |

### Shared

| File | Responsibility | Dependencies |
|------|----------------|--------------|
| `preload.ts` | IPC bridge | electron |
| `types/*.ts` | Type definitions | none |

## Testing Strategy by Layer

### Models
- Unit test state management
- Test validation logic
- Test event emission
- Mock: None needed (pure logic)

### Controllers
- Unit test business logic
- Test error handling
- Test coordination
- Mock: Models, Views, Drivers

### Views
- Integration test rendering
- Test event binding
- Test visual updates
- Mock: DOM, Controllers

### Drivers
- Integration test with mock hardware
- Test error conditions
- Test data parsing
- Mock: SerialPort

## Performance Considerations

### Renderer Process
- Use `requestAnimationFrame` for smooth animations
- Throttle pan/zoom events (16ms / 60fps)
- Virtual rendering for large element lists
- Canvas fallback for massive datasets (1000+ elements)

### Main Process
- Use streams for large data
- Don't block event loop
- Buffer serial data efficiently
- Clean up resources on disconnect

### IPC Communication
- Batch updates when possible
- Avoid sending large objects frequently
- Use binary buffers for large data
- Debounce state sync (100ms)

---

**Remember:** Models hold state, Views render state, Controllers connect them with logic.

