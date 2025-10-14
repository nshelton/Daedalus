# Implementation Checklist

## Phase 1: Foundation ✅

### Directory Structure
- [ ] Create `src/main/controllers/` directory
- [ ] Create `src/main/models/` directory
- [ ] Create `src/main/drivers/` directory
- [ ] Create `src/renderer/` directory
- [ ] Create `src/renderer/controllers/` directory
- [ ] Create `src/renderer/models/` directory
- [ ] Create `src/renderer/views/` directory
- [ ] Create `src/renderer/utils/` directory
- [ ] Create `src/types/` directory

### Type Definitions
- [ ] Create `src/types/plot.types.ts` with:
  - [ ] `Point` interface
  - [ ] `SVGElement` interface
  - [ ] `Transform` interface
  - [ ] `SVGStyle` interface
  - [ ] `ViewPort` interface
  - [ ] `PlotState` interface
- [ ] Create `src/types/serial.types.ts` with:
  - [ ] `SerialPortInfo` interface
  - [ ] `SerialConfig` interface
  - [ ] `SerialState` interface
- [ ] Create `src/types/ipc.types.ts` with:
  - [ ] `IPCRequest` type
  - [ ] `IPCEvent` type
- [ ] Update `src/types.d.ts` with window.electronAPI types

## Phase 2: Models ⏸️

### PlotModel (Renderer)
- [ ] Create `src/renderer/models/PlotModel.ts`
- [ ] Implement state storage
- [ ] Implement element management methods:
  - [ ] `addElement()`
  - [ ] `removeElement()`
  - [ ] `updateElement()`
  - [ ] `getElement()`
  - [ ] `getAllElements()`
- [ ] Implement viewport management:
  - [ ] `setViewport()`
  - [ ] `getViewport()`
  - [ ] `resetViewport()`
- [ ] Implement selection:
  - [ ] `selectElement()`
  - [ ] `getSelectedElement()`
- [ ] Implement event system:
  - [ ] `on()`
  - [ ] `emit()`
  - [ ] `off()`
- [ ] Add validation to all setters
- [ ] Add TypeScript strict typing
- [ ] Write unit tests

### SerialModel (Main)
- [ ] Create `src/main/models/SerialModel.ts`
- [ ] Implement state storage
- [ ] Implement connection state methods:
  - [ ] `setConnected()`
  - [ ] `isConnected()`
- [ ] Implement configuration:
  - [ ] `setConfig()`
  - [ ] `getConfig()`
- [ ] Implement port management:
  - [ ] `setAvailablePorts()`
  - [ ] `getAvailablePorts()`
- [ ] Implement statistics:
  - [ ] `incrementBytesReceived()`
  - [ ] `incrementBytesSent()`
  - [ ] `getStatistics()`
  - [ ] `resetStatistics()`
- [ ] Implement error handling:
  - [ ] `setError()`
  - [ ] `getError()`
  - [ ] `clearError()`
- [ ] Implement state getter:
  - [ ] `getState()`
- [ ] Add TypeScript strict typing
- [ ] Write unit tests

## Phase 3: Drivers ⏸️

### SerialDriver (Main)
- [ ] Create `src/main/drivers/SerialDriver.ts`
- [ ] Implement port discovery:
  - [ ] `listPorts()`
- [ ] Implement connection:
  - [ ] `connect()`
  - [ ] `disconnect()`
  - [ ] `isConnected()`
- [ ] Implement data I/O:
  - [ ] `write()`
  - [ ] `onData()`
  - [ ] `removeDataListener()`
- [ ] Implement error handling:
  - [ ] `onError()`
  - [ ] Error recovery logic
- [ ] Implement cleanup:
  - [ ] `destroy()`
- [ ] Add ReadlineParser for line-based data
- [ ] Add TypeScript strict typing
- [ ] Write integration tests with mock SerialPort

### TestPatternGenerator
- [ ] Create `src/main/drivers/TestPatternGenerator.ts`
- [ ] Implement circle pattern:
  - [ ] `startCirclePattern()`
  - [ ] Generate SVG circle commands
- [ ] Implement noise pattern:
  - [ ] `startNoisePattern()`
  - [ ] Generate random SVG paths
- [ ] Implement sine wave pattern:
  - [ ] `startSineWavePattern()`
  - [ ] Generate smooth wave paths
- [ ] Implement control:
  - [ ] `stop()`
  - [ ] `setUpdateRate()`
- [ ] Add configurable parameters (speed, size, etc.)
- [ ] Add TypeScript strict typing

## Phase 4: Controllers ⏸️

### PlotController (Renderer)
- [ ] Create `src/renderer/controllers/PlotController.ts`
- [ ] Wire up model and view in constructor
- [ ] Implement element operations:
  - [ ] `createCircle()`
  - [ ] `createPath()`
  - [ ] `createRect()`
  - [ ] `deleteSelected()`
- [ ] Implement drag operations:
  - [ ] `startDrag()`
  - [ ] `drag()` with transform calculation
  - [ ] `endDrag()`
- [ ] Implement resize operations:
  - [ ] `startResize()`
  - [ ] `resize()` with scale calculation
  - [ ] `endResize()`
- [ ] Implement viewport operations:
  - [ ] `pan()` with delta calculation
  - [ ] `zoom()` with center point
  - [ ] `resetView()`
- [ ] Implement selection:
  - [ ] `selectElementAt()` with hit testing
  - [ ] `clearSelection()`
- [ ] Implement grid:
  - [ ] `toggleGrid()`
  - [ ] `setGridSize()`
- [ ] Implement test pattern:
  - [ ] `generateTestPattern()`
- [ ] Add keyboard shortcuts
- [ ] Add TypeScript strict typing
- [ ] Write unit tests with mocks

### SerialController (Main)
- [ ] Create `src/main/controllers/SerialController.ts`
- [ ] Wire up driver, model, and window in constructor
- [ ] Implement port operations:
  - [ ] `refreshPorts()`
- [ ] Implement connection:
  - [ ] `connect()` with error handling
  - [ ] `disconnect()` with cleanup
- [ ] Implement data handling:
  - [ ] `handleData()` private method
  - [ ] `sendData()` with validation
- [ ] Implement test mode:
  - [ ] `startTestPattern()`
  - [ ] `stopTestPattern()`
- [ ] Implement state sync:
  - [ ] `syncStateToRenderer()` private method
- [ ] Set up IPC handlers:
  - [ ] `serial:list-ports`
  - [ ] `serial:connect`
  - [ ] `serial:disconnect`
  - [ ] `serial:send`
  - [ ] `serial:start-test`
  - [ ] `serial:stop-test`
- [ ] Add error handling for all operations
- [ ] Add TypeScript strict typing
- [ ] Write integration tests

## Phase 5: Views ⏸️

### PlotView (Renderer)
- [ ] Create `src/renderer/views/PlotView.ts`
- [ ] Implement initialization:
  - [ ] `initialize()` - create SVG structure
  - [ ] Create main SVG element
  - [ ] Create defs section
  - [ ] Create main group for elements
  - [ ] Create grid group
- [ ] Implement rendering:
  - [ ] `render()` - full state render
  - [ ] `renderElement()` - single element
  - [ ] `updateElement()` - update existing
  - [ ] `removeElement()` - remove element
- [ ] Implement element renderers by type:
  - [ ] Render circle
  - [ ] Render path
  - [ ] Render rect
  - [ ] Render line
  - [ ] Render polyline
- [ ] Implement viewport:
  - [ ] `applyViewport()` - apply transform
  - [ ] Calculate transform matrix
- [ ] Implement grid:
  - [ ] `renderGrid()` - dynamic grid
  - [ ] Adjust grid to zoom level
- [ ] Implement selection:
  - [ ] `highlightElement()` - show outline
  - [ ] `clearHighlight()` - remove outline
- [ ] Implement resize handles:
  - [ ] `showResizeHandles()` - 8 handles
  - [ ] `hideResizeHandles()`
- [ ] Implement event binding:
  - [ ] `onElementClick()`
  - [ ] `onElementDragStart()`
  - [ ] `onElementDrag()`
  - [ ] `onElementDragEnd()`
  - [ ] `onCanvasPan()`
  - [ ] `onCanvasZoom()`
- [ ] Implement utilities:
  - [ ] `screenToWorld()` coordinate transform
  - [ ] `worldToScreen()` coordinate transform
- [ ] Add smooth animations with requestAnimationFrame
- [ ] Add TypeScript strict typing
- [ ] Write integration tests

### ControlPanelView (Renderer)
- [ ] Create `src/renderer/views/ControlPanelView.ts`
- [ ] Implement initialization:
  - [ ] `initialize()` - bind to DOM elements
- [ ] Implement render methods:
  - [ ] `renderPortList()`
  - [ ] `renderConnectionStatus()`
  - [ ] `renderPlotSettings()`
- [ ] Implement event handlers:
  - [ ] Connect button click
  - [ ] Refresh ports click
  - [ ] Settings changes
- [ ] Add callbacks to controller
- [ ] Add TypeScript strict typing

### StatusView (Renderer)
- [ ] Create `src/renderer/views/StatusView.ts`
- [ ] Implement initialization:
  - [ ] `initialize()` - bind to DOM elements
- [ ] Implement render methods:
  - [ ] `renderConnectionStatus()`
  - [ ] `renderStatistics()`
  - [ ] `renderError()`
- [ ] Implement update methods:
  - [ ] `updateBytesReceived()`
  - [ ] `updateSampleRate()`
  - [ ] `updateLastValue()`
- [ ] Add TypeScript strict typing

### SVGRenderer Utility
- [ ] Create `src/renderer/utils/SVGRenderer.ts`
- [ ] Implement SVG element creation helpers:
  - [ ] `createCircle()`
  - [ ] `createPath()`
  - [ ] `createRect()`
  - [ ] `createLine()`
  - [ ] `createPolyline()`
- [ ] Implement attribute helpers:
  - [ ] `setTransform()`
  - [ ] `setStyle()`
  - [ ] `setBounds()`
- [ ] Add TypeScript strict typing

### Transform Utility
- [ ] Create `src/renderer/utils/Transform.ts`
- [ ] Implement matrix operations:
  - [ ] `createMatrix()`
  - [ ] `applyTransform()`
  - [ ] `inverseTransform()`
- [ ] Implement hit testing:
  - [ ] `pointInBounds()`
  - [ ] `pointInElement()`
- [ ] Implement resize calculations:
  - [ ] `calculateNewBounds()`
  - [ ] `maintainAspectRatio()`
- [ ] Add TypeScript strict typing
- [ ] Write unit tests

## Phase 6: IPC Integration ⏸️

### Preload Bridge
- [ ] Update `src/preload.ts` with new API:
  - [ ] `listPorts()`
  - [ ] `connect()`
  - [ ] `disconnect()`
  - [ ] `sendData()`
  - [ ] `startTestPattern()`
  - [ ] `stopTestPattern()`
  - [ ] `onSerialData()`
  - [ ] `onSerialStateChanged()`
  - [ ] `onSerialError()`
- [ ] Update type definitions in `src/types.d.ts`
- [ ] Add proper error handling

### Main Process Integration
- [ ] Update `src/main.ts`:
  - [ ] Import SerialController
  - [ ] Create SerialController instance
  - [ ] Remove old IPC handlers
  - [ ] Wire up new IPC handlers through controller
- [ ] Test IPC communication
- [ ] Add error boundaries

### Renderer Integration
- [ ] Update `src/renderer.ts`:
  - [ ] Remove old code
  - [ ] Import all MVC components
  - [ ] Create model instances
  - [ ] Create view instances
  - [ ] Create controller instances
  - [ ] Wire up components
  - [ ] Implement initialization flow
- [ ] Test MVC wiring

### Auto-Connect Logic
- [ ] Implement in `src/renderer.ts`:
  - [ ] Fetch available ports on load
  - [ ] Connect to first port if available
  - [ ] Start test pattern after connection
  - [ ] Handle connection errors gracefully
- [ ] Add user preference for auto-connect (optional)
- [ ] Add reconnection logic

## Phase 7: Interaction Features ⏸️

### Pan & Zoom
- [ ] Implement mouse wheel zoom:
  - [ ] Capture wheel event
  - [ ] Calculate zoom factor
  - [ ] Calculate zoom center point
  - [ ] Update viewport with smooth animation
- [ ] Implement pan:
  - [ ] Middle-mouse drag
  - [ ] Space + drag alternative
  - [ ] Update viewport with smooth animation
- [ ] Add zoom limits:
  - [ ] Minimum zoom (0.1x)
  - [ ] Maximum zoom (10x)
- [ ] Add pan limits (optional):
  - [ ] Constrain to content bounds
- [ ] Add smooth transitions with easing

### Drag & Drop
- [ ] Implement element dragging:
  - [ ] Click to select element
  - [ ] Mouse down starts drag
  - [ ] Mouse move updates position
  - [ ] Mouse up ends drag
- [ ] Add visual feedback:
  - [ ] Ghost preview during drag
  - [ ] Cursor change
- [ ] Add grid snapping (optional):
  - [ ] Snap to grid toggle
  - [ ] Calculate snap positions
- [ ] Handle edge cases:
  - [ ] Dragging out of bounds
  - [ ] Fast mouse movements

### Resize
- [ ] Implement resize handles:
  - [ ] Show 8 handles on selection
  - [ ] Position handles at corners and edges
  - [ ] Style handles appropriately
- [ ] Implement resize logic:
  - [ ] Click handle to start resize
  - [ ] Drag to resize
  - [ ] Update element bounds
- [ ] Add constraints:
  - [ ] Minimum size
  - [ ] Aspect ratio (shift key)
- [ ] Handle different resize directions:
  - [ ] Corner handles (2D resize)
  - [ ] Edge handles (1D resize)

### Selection
- [ ] Implement click selection:
  - [ ] Hit testing
  - [ ] Update selection state
  - [ ] Visual highlight
- [ ] Implement box selection (optional):
  - [ ] Drag on empty space
  - [ ] Show selection box
  - [ ] Select all intersecting elements
- [ ] Implement multi-select (optional):
  - [ ] Ctrl/Cmd key modifier
  - [ ] Add to selection
- [ ] Implement keyboard shortcuts:
  - [ ] Delete to remove selected
  - [ ] Escape to clear selection
  - [ ] Ctrl+A to select all (optional)

## Phase 8: Advanced Features ⏸️

### Performance Optimization
- [ ] Implement virtual rendering:
  - [ ] Calculate visible elements
  - [ ] Only render visible
  - [ ] Update on viewport change
- [ ] Optimize rendering:
  - [ ] Batch DOM updates
  - [ ] Use DocumentFragment
  - [ ] Minimize reflows
- [ ] Implement throttling:
  - [ ] Throttle pan events (16ms)
  - [ ] Throttle zoom events (16ms)
  - [ ] Debounce resize events (100ms)
- [ ] Consider Canvas fallback:
  - [ ] Detect large datasets (1000+ elements)
  - [ ] Implement Canvas renderer
  - [ ] Switch automatically

### Serial Data Streaming
- [ ] Define SVG command protocol:
  - [ ] Command format (e.g., "CIRCLE x y r")
  - [ ] Path format (e.g., "PATH M0,0 L10,10")
  - [ ] Style format (e.g., "STYLE stroke:#fff")
- [ ] Implement parser:
  - [ ] Parse incoming commands
  - [ ] Validate format
  - [ ] Handle errors
- [ ] Implement incremental building:
  - [ ] Support path building over time
  - [ ] Handle partial data
- [ ] Implement buffer management:
  - [ ] Ring buffer for data
  - [ ] Limit memory usage
- [ ] Add real-time updates:
  - [ ] Update at 60fps max
  - [ ] Batch updates

### Export/Import
- [ ] Implement SVG export:
  - [ ] Serialize current state to SVG
  - [ ] Save to file
  - [ ] Include viewport info (optional)
- [ ] Implement SVG import:
  - [ ] Load SVG file
  - [ ] Parse into elements
  - [ ] Add to model
- [ ] Implement state save/load:
  - [ ] Serialize PlotState to JSON
  - [ ] Save to file
  - [ ] Load from file
- [ ] Add file dialogs

## UI Updates ⏸️

### HTML Structure
- [ ] Update `index.html`:
  - [ ] Remove old canvas element
  - [ ] Add SVG container
  - [ ] Update control panel
  - [ ] Add grid toggle
  - [ ] Add export/import buttons

### CSS Styling
- [ ] Update `styles.css`:
  - [ ] Style SVG container
  - [ ] Style selection outline
  - [ ] Style resize handles
  - [ ] Style grid
  - [ ] Add cursors for interactions
  - [ ] Add smooth transitions

## Testing ⏸️

### Unit Tests
- [ ] Test PlotModel
- [ ] Test SerialModel
- [ ] Test Transform utilities
- [ ] Test SVGRenderer utilities

### Integration Tests
- [ ] Test PlotController + PlotModel + PlotView
- [ ] Test SerialController + SerialDriver + SerialModel
- [ ] Test IPC communication
- [ ] Test auto-connect flow

### Manual Testing
- [ ] Test with real serial device
- [ ] Test pan/zoom smoothness
- [ ] Test drag/resize accuracy
- [ ] Test large SVG performance
- [ ] Test error scenarios

## Documentation ⏸️

- [ ] Update README.md
- [ ] Document SVG command protocol
- [ ] Document keyboard shortcuts
- [ ] Add screenshots
- [ ] Add usage examples

---

## Progress Tracking

**Total Tasks:** ~200+  
**Completed:** 0  
**In Progress:** 0  
**Not Started:** 200+  

**Current Phase:** Phase 1 (Foundation)  
**Next Milestone:** Complete type definitions and directory structure

---

## Notes

- Check off items as you complete them
- Add notes for any blockers or issues
- Update progress tracking regularly
- Celebrate milestones! 🎉

