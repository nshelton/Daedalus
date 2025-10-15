# Pen Up/Down Fix

## The Problem ❌

The pen up and pen down commands were **reversed** due to incorrect servo parameter mapping in the EBB configuration.

### What Was Wrong

**Incorrect Parameter Mapping:**
```typescript
// WRONG - These were backwards!
async setPenUpValue(val: number): Promise<void> {
    await this.configureServo(5, val); // Used parameter 5 (servo max) for pen up
}

async setPenDownValue(val: number): Promise<void> {
    await this.configureServo(4, val); // Used parameter 4 (servo min) for pen down
}
```

**EBB Servo Parameters:**
- **Parameter 4** = Servo Min (should be pen up)
- **Parameter 5** = Servo Max (should be pen down)

## The Fix ✅

**Corrected Parameter Mapping:**
```typescript
// CORRECT - Now properly mapped!
async setPenUpValue(val: number): Promise<void> {
    await this.configureServo(4, val); // Parameter 4 = servo min (pen up)
}

async setPenDownValue(val: number): Promise<void> {
    await this.configureServo(5, val); // Parameter 5 = servo max (pen down)
}
```

## How EBB Servo Control Works

### Servo Parameters
- **Parameter 4 (Servo Min)**: Minimum pulse width → Pen Up position
- **Parameter 5 (Servo Max)**: Maximum pulse width → Pen Down position

### Typical Values
- **Pen Up**: 16000 (1.33ms pulse) - Higher value = pen lifted
- **Pen Down**: 12000 (1.0ms pulse) - Lower value = pen lowered

### EBB Commands
```bash
# Configure servo positions
SC,4,16000  # Set servo min (pen up) to 16000
SC,5,12000  # Set servo max (pen down) to 12000

# Control pen
SP,0        # Pen up (uses servo min value)
SP,1        # Pen down (uses servo max value)
```

## What This Fixes

### Before (Broken)
- `plotterPenUp()` → Used servo max value → Pen went down
- `plotterPenDown()` → Used servo min value → Pen went up
- **Result**: Pen up/down were completely reversed!

### After (Fixed)
- `plotterPenUp()` → Uses servo min value → Pen goes up ✅
- `plotterPenDown()` → Uses servo max value → Pen goes down ✅
- **Result**: Pen up/down work correctly!

## Testing the Fix

After connecting to your plotter, test the pen control:

```typescript
// Test pen up/down
await window.electronAPI.plotterPenUp();   // Should lift pen
await window.electronAPI.plotterPenDown(); // Should lower pen
```

If the pen movements are still reversed, you may need to:
1. **Swap the position values** in your UI sliders
2. **Or physically reverse the servo** in your plotter hardware

## Default Values

The default values are now correctly configured:
- **Pen Up Position**: 16000 (1.33ms pulse)
- **Pen Down Position**: 12000 (1.0ms pulse)

These values work for most AxiDraw and EggBot setups. You can adjust them using the sliders in the UI if needed.

## EBB Documentation Reference

This fix aligns with the official EBB documentation:
- [EBB Command Set](https://evil-mad.github.io/EggBot/ebb.html)
- SC command: Configure servo parameters
- SP command: Set pen state (0=up, 1=down)

The pen up/down should now work correctly with your plotter!
