# Plotter Controller Guide

This guide explains how to use the PlotterModel and PlotterController to control an AxiDraw or EggBot plotter using the EiBotBoard (EBB) protocol.

## Architecture

Following the MVC pattern:

- **PlotterModel** (`src/models/PlotterModel.ts`) - Stores all plotter state
- **PlotterController** (`src/controllers/PlotterController.ts`) - Handles business logic and EBB commands
- **SerialController** (`src/controllers/SerialController.ts`) - Manages low-level serial communication

## EBB Protocol Implementation

The PlotterController implements the EiBotBoard command protocol based on [EBB firmware v3.0+ documentation](https://evil-mad.github.io/EggBot/ebb.html).

### Key EBB Commands Implemented

| Command | Description | Method |
|---------|-------------|--------|
| `SP` | Set pen state (up/down) | `setPenState()`, `penUp()`, `penDown()` |
| `SC` | Configure servo parameters | `configureServo()` |
| `SM` | Stepper move (duration-based) | `stepperMove()`, `executeMove()` |
| `LM` | Low-level move (rate-based) | `lowLevelMove()` |
| `EM` | Enable/disable motors | `enableMotors()` |
| `QG` | Query general status | `queryStatus()` |
| `R` | Reset | `reset()` |

## Usage from Renderer Process

The plotter API is exposed through the `window.electronAPI` object:

```typescript
// Connect to serial port first
await window.electronAPI.connectSerial('/dev/ttyUSB0', 115200);

// Configure pen positions (in servo units, 0-65535)
await window.electronAPI.plotterSetPenUpValue(16000);   // Default: 1.33ms pulse
await window.electronAPI.plotterSetPenDownValue(12000); // Lower position

// Set plotting speed (arbitrary units)
await window.electronAPI.plotterSetSpeed(1000);

// Test pen up/down
await window.electronAPI.plotterPenDown();
await window.electronAPI.plotterPenUp();

// Plot a path (array of polylines)
const paths = [
  [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]], // Square
  [[50, 50], [150, 150]] // Diagonal line
];
await window.electronAPI.plotterPlotPath(paths, true); // true = lift pen between paths

// Start queue processing
await window.electronAPI.plotterStartQueue();

// Pause/resume
await window.electronAPI.plotterPause();
await window.electronAPI.plotterResume();

// Check plotter state
const state = await window.electronAPI.plotterGetState();
console.log('Position:', state.position);
console.log('Commands sent:', state.commandsSent);
console.log('Commands completed:', state.commandsCompleted);

// When done
await window.electronAPI.plotterDisengage(); // Pen up, motors off
```

## PlotterModel State

The PlotterModel maintains:

```typescript
interface PlotterState {
  position: [number, number];        // Current [x, y] position in steps
  penUpPosition: number;             // Servo value for pen up (default: 16000)
  penDownPosition: number;           // Servo value for pen down (default: 12000)
  speed: number;                     // Movement speed
  isPaused: boolean;                 // Pause state
  commandsSent: number;              // Commands sent to EBB
  commandsCompleted: number;         // Commands completed by EBB
  queueLength: number;               // Number of queued commands
  startTime: Date | null;            // Plot start time
}
```

## Command Queue

The PlotterController uses a command queue system:

1. **Queueing**: Commands are queued when you call methods like `plotPath()` or `moveTo()`
2. **Processing**: Call `startQueueConsumption()` to begin processing the queue
3. **Throttling**: Maximum 500 commands pending at once to avoid buffer overflow
4. **Batch Processing**: Processes up to 10 commands per iteration (every 10ms)

### Queue Command Types

```typescript
interface PlotCommand {
  type: 'move' | 'up' | 'down' | 'query';
  params?: any[];
}
```

## Servo Configuration

Pen up/down positions are configured using EBB servo parameters:

- **Servo Min** (parameter 4): Pen up position
- **Servo Max** (parameter 5): Pen down position
- **Duration Calculation**: Auto-calculated based on position difference × 0.06

From EBB docs (FAQ Q1):
```
duration = (penUpPosition - penDownPosition) × 0.024ms / servoRate
```

Default servo rate makes the formula:
```
upDownDurationMs = |penUpPosition - penDownPosition| × 0.06
```

## Movement Commands

### High-level Movement

Use `plotPath()` for complex paths:

```typescript
plotterController.plotPath([
  [[0, 0], [100, 100]], // First path
  [[200, 200], [300, 300]] // Second path
], true); // Auto pen lift between paths
```

### Low-level Movement

Direct motor control:

```typescript
// Move 100 steps on X, 50 steps on Y over 1000ms
await plotterController.stepperMove(1000, 100, 50);

// Or rate-based
await plotterController.lowLevelMove(1000, 100, 50); // 1000 steps/sec initial rate
```

## Response Handling

The controller processes EBB responses:

- **OK**: Increments `commandsCompleted` counter
- **Query Responses**: Logged to console (can be extended)
- **Errors**: Handled gracefully with error messages

## Main Process Integration

In `src/main.ts`, the plotter controller is initialized:

```typescript
const serialModel = new SerialModel();
const serialController = new SerialController(serialModel);
const plotterModel = new PlotterModel();
const plotterController = new PlotterController(plotterModel, serialController);
```

All plotter operations are exposed via IPC handlers (e.g., `plotter-pen-up`, `plotter-plot-path`, etc.).

## Performance Considerations

From EBB documentation:

- **Step Pulse Duration**: 1.6 - 2.3 μs (firmware 2.7.0+)
- **Minimum Move Duration**: 2-4ms for continuous streaming (depends on step rate)
- **Max Pending Commands**: Keep under 500 to avoid buffer issues
- **Processing Interval**: Queue processes every 10ms

## Example: Complete Plotting Session

```typescript
// 1. Connect
await window.electronAPI.connectSerial('/dev/ttyUSB0', 115200);

// 2. Configure
await window.electronAPI.plotterSetPenUpValue(16000);
await window.electronAPI.plotterSetPenDownValue(12000);
await window.electronAPI.plotterSetSpeed(1000);

// 3. Create paths
const circle = generateCirclePath(100, 100, 50, 32); // Helper function
const paths = [circle];

// 4. Queue plotting commands
await window.electronAPI.plotterPlotPath(paths, true);

// 5. Start execution
await window.electronAPI.plotterStartQueue();

// 6. Monitor progress
const checkProgress = setInterval(async () => {
  const state = await window.electronAPI.plotterGetState();
  console.log(`Progress: ${state.commandsCompleted}/${state.commandsSent}`);
  
  if (state.commandsCompleted >= state.commandsSent && state.queueLength === 0) {
    clearInterval(checkProgress);
    console.log('Plot complete!');
  }
}, 100);

// 7. Clean up when done
await window.electronAPI.plotterDisengage();
```

## Differences from Old Driver

### Old PlotterDriver
- Had hardcoded `Axidraw` class reference
- Mixed localStorage directly in driver
- Combined queueing and execution logic

### New PlotterController
- Uses SerialController for all communication
- Model stores state, controller handles logic (MVC)
- EBB protocol commands directly implemented
- Settings persistence should be handled by renderer/main process
- Cleaner separation of concerns

## Future Enhancements

Possible additions:

1. **Path Optimization**: Integrate optimizer (like old `Optomizer` class)
2. **Settings Persistence**: Add localStorage/config file support
3. **Advanced Queries**: Parse QG responses for motor status, button state
4. **Acceleration Control**: Implement acceleration curves for smoother motion
5. **Error Recovery**: Retry logic for failed commands
6. **Progress Events**: Emit events for UI updates

## References

- [EBB Command Reference](https://evil-mad.github.io/EggBot/ebb.html)
- [AxiDraw Documentation](https://axidraw.com/)
- [EggBot Wiki](http://wiki.evilmadscientist.com/eggbot)

