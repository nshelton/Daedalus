# Position Querying Example

This example shows how to query the current position of the plotter's head using the EBB protocol.

## Available Methods

### 1. **Modern Approach (Recommended)**
Use the `QG` (Query General) command which returns comprehensive status including position:

```typescript
// Query current position
const result = await window.electronAPI.plotterGetPosition();
if (result.success) {
    console.log('Current position:', result.position); // [x, y] in mm
} else {
    console.error('Failed to get position:', result.error);
}
```

### 2. **Direct EBB Commands**
You can also send EBB commands directly:

```typescript
// QG - Query General (modern, recommended)
await window.electronAPI.plotterQueryStatus(); // Sends QG command

// QM - Query Motors (legacy, still supported)
await window.electronAPI.plotterQueryMotors(); // Sends QM command
```

## Response Format

### QG Response
```
QG,<status_bits>,<motor1_position>,<motor2_position>
```
- `status_bits`: Status flags (hex format)
- `motor1_position`: X-axis position in steps
- `motor2_position`: Y-axis position in steps

### QM Response (Legacy)
```
QM,<motor1_position>,<motor2_position>
```
- `motor1_position`: X-axis position in steps  
- `motor2_position`: Y-axis position in steps

## Position Conversion

The system automatically converts step positions to mm coordinates:
- **Steps per mm**: 80 (AxiDraw/EggBot standard)
- **Formula**: `mm = steps / 80`

## Important Notes

### Relative vs Absolute Position
- **Relative Position**: The EBB tracks position relative to the start of the current plot
- **Absolute Position**: Not available - the EBB has no encoders or limit switches
- **Position Reset**: Position resets to [0,0] when you start a new plot or reset the system

### When to Query Position
- **During plotting**: Position updates automatically as commands are executed
- **After moves**: Query position after `moveTo()` or `plotPath()` calls
- **Status monitoring**: Use `plotterGetState()` to get the current tracked position

## Complete Example

```typescript
// Connect to plotter
await window.electronAPI.connectSerial('/dev/ttyUSB0', 115200);
await window.electronAPI.plotterInitialize();

// Get current position
const positionResult = await window.electronAPI.plotterGetPosition();
if (positionResult.success) {
    const [x, y] = positionResult.position;
    console.log(`Plotter is at: X=${x.toFixed(2)}mm, Y=${y.toFixed(2)}mm`);
}

// Move to a new position
await window.electronAPI.plotterMoveTo([50, 50]); // Move to 50mm, 50mm

// Query position again
const newPosition = await window.electronAPI.plotterGetPosition();
if (newPosition.success) {
    console.log(`New position: X=${newPosition.position[0].toFixed(2)}mm, Y=${newPosition.position[1].toFixed(2)}mm`);
}

// Plot a path and monitor position
const paths = [[[0, 0], [100, 100]]];
await window.electronAPI.plotterPlotPath(paths);
await window.electronAPI.plotterStartQueue();

// Check position during plotting
setInterval(async () => {
    const state = await window.electronAPI.plotterGetState();
    console.log(`Current position: [${state.position[0].toFixed(2)}, ${state.position[1].toFixed(2)}]mm`);
}, 1000);
```

## Troubleshooting

### No Position Data
- Ensure the plotter is connected and initialized
- Check that the EBB is responding to commands
- Verify the serial connection is working

### Inaccurate Position
- Position is relative to plot start, not absolute
- Reset position by calling `plotterReset()` or starting a new plot
- Check that steps-per-mm conversion is correct (80 for AxiDraw/EggBot)

### Position Not Updating
- The position only updates when you query it
- Use `plotterGetState()` for real-time position tracking
- Position updates automatically during plotting operations
