# Position Reset on Connection

## What Was Implemented

I've added automatic position reset to (0,0) when the plotter connects. Here's what happens now:

### ✅ **New Connection Flow**

1. **Connect to Serial Port** - Find and connect to the plotter
2. **Initialize Plotter** - Configure servo settings
3. **🆕 Reset Position to (0,0)** - Send EBB reset command and set software position
4. **Query Actual Position** - Sync with hardware to verify position
5. **Ready to Plot** - Position is now known and synchronized

### ✅ **New Methods Added**

#### `plotterSetOrigin()`
```typescript
// Sets position to (0,0) - useful for connection initialization
await window.electronAPI.plotterSetOrigin();
```

#### Enhanced `plotterReset()`
```typescript
// Now sends EBB reset command to hardware AND resets software model
await window.electronAPI.plotterReset();
```

### ✅ **What Happens on Connection**

```typescript
// 1. Connect to plotter
await window.electronAPI.connectSerial(port, 115200);

// 2. Initialize (configure servos)
await window.electronAPI.plotterInitialize();

// 3. 🆕 Set position to origin (0,0)
await window.electronAPI.plotterSetOrigin();

// 4. 🆕 Query actual position to sync with hardware
const position = await window.electronAPI.plotterGetPosition();
console.log('Plotter is at:', position.position); // Should be [0, 0]
```

## Before vs After

### ❌ **Before (Previous Behavior)**
- Model started at (0,0) but EBB hardware position was unknown
- No synchronization between software and hardware
- Could cause plotting issues if EBB was at different position

### ✅ **After (New Behavior)**
- EBB hardware is reset to (0,0) via `R` command
- Software model is set to (0,0)
- Position is queried to verify synchronization
- Both software and hardware are at known position

## Technical Details

### EBB Reset Command
The `R` command sent to the EBB:
- Resets the EBB's internal position tracking
- Clears any pending commands
- Sets the EBB's position counter to (0,0)
- This is the standard EBB reset command from the [official documentation](https://evil-mad.github.io/EggBot/ebb.html)

### Position Synchronization
1. **Hardware Reset**: `R` command resets EBB position tracking
2. **Software Reset**: Model position set to [0,0]
3. **Verification**: Query actual position to confirm sync
4. **Logging**: Console shows actual position for debugging

## Usage Examples

### Manual Position Reset
```typescript
// Reset position anytime during operation
await window.electronAPI.plotterSetOrigin();
console.log('Position reset to (0,0)');
```

### Check Position After Reset
```typescript
// Set to origin and verify
await window.electronAPI.plotterSetOrigin();
const result = await window.electronAPI.plotterGetPosition();
if (result.success && result.position) {
    console.log(`Position: [${result.position[0]}, ${result.position[1]}]mm`);
}
```

### Full Reset (Hardware + Software)
```typescript
// Complete reset - clears everything
await window.electronAPI.plotterReset();
```

## Benefits

1. **Predictable Starting Position** - Always starts at (0,0)
2. **Hardware-Software Sync** - Both know the same position
3. **Prevents Plotting Issues** - No position mismatches
4. **Debugging Friendly** - Console shows actual position
5. **Standard EBB Protocol** - Uses official reset command

## Console Output

When connecting, you'll now see:
```
Plotter initialized successfully
Setting plotter position to origin (0,0)...
Position set to origin (0,0)
Plotter actual position: [0.00, 0.00]mm
```

This ensures your plotter always starts from a known, synchronized position!
