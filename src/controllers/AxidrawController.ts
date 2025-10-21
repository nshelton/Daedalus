import { SerialController } from './SerialController';
import { AxidrawModel } from '../models/AxidrawModel';

export class AxidrawController {
    private model: AxidrawModel;
    private serialController: SerialController;
    private responseBuffer: string = '';
    private upDownDurationMs: number = 100;
    private readonly UP_DOWN_DELAY_SCALE = 0.06;
    private consumeQueueInterval: NodeJS.Timeout | null = null;
    private readStatusInterval: NodeJS.Timeout | null = null;
    private finishTimeout: NodeJS.Timeout | null = null;
    private readonly PEN_UP_COMMAND = 4;
    private readonly PEN_DOWN_COMMAND = 5;
    private readonly SP_PEN_UP_STATE = 1;
    private readonly SP_PEN_DOWN_STATE = 0;


    // At 100% speed, aim for ~25000 steps/second (AxiDraw max)
    // This is much faster and more practical
    private readonly MAX_STEPS_PER_SECOND = 5000;


    // EiBotBoard/AxiDraw has 2032 steps per inch = 80 steps per mm
    private readonly STEPS_PER_MM = 80;

    constructor(model: AxidrawModel, serialController: SerialController) {
        this.model = model;
        this.serialController = serialController;
        this.setupSerialDataHandler();
        this.updateUpDownDuration();
    }

    async initialize(): Promise<void> {
        // Configure servo positions on startup
        await this.setPenUpValue(this.model.getPenUpPosition());
        await this.setPenDownValue(this.model.getPenDownPosition());
    }

    private setupSerialDataHandler(): void {
        this.serialController.onData((data: string) => {
            this.responseBuffer += data;
            this.processResponseBuffer();
        });
    }

    private processResponseBuffer(): void {
        const lines = this.responseBuffer.split('\r\n');
        this.responseBuffer = lines.pop() || '';

        lines.forEach(line => {
            if (line.trim()) {
                this.handleResponse(line.trim());
            }
        });
    }

    private handleResponse(response: string): void {
        // Handle "OK" responses which indicate command completion
        if (response === 'OK' || response.includes('OK')) {
            const completed = this.model.getCommandsCompleted() + 1;
            this.model.setCommandsCompleted(completed);
            // Only log occasionally to avoid spam
            if (completed % 10 === 0) {
                console.log('Commands completed:', completed);
            }
        } else if (response.startsWith('QG,')) {
            // Parse QG (Query General) response
            console.log('QG Response:', response);
            // Count query responses as completed to keep pending in sync
            const completed = this.model.getCommandsCompleted() + 1;
            this.model.setCommandsCompleted(completed);
        } else if (response.startsWith('QM,')) {
            // Parse QM (Query Motors) response - legacy but still supported
            console.log('QM Response:', response);
            // Count query responses as completed to keep pending in sync
            const completed = this.model.getCommandsCompleted() + 1;
            this.model.setCommandsCompleted(completed);
        } else if (response.trim().length > 0) {
            // Handle other responses
            console.log('EBB Response:', response);
        }
    }

    private async sendCommand(command: string): Promise<void> {
        await this.serialController.write(command + '\r');
        this.model.incrementCommandsSent();
    }

    // EBB Command: Configure servo motor settings
    async configureServo(parameter: number, value: number): Promise<void> {
        // SC,<parameter>,<value>
        // parameter 4 = servo min (pen up position)
        // parameter 5 = servo max (pen down position)
        // parameter 10 = servo rate up
        // parameter 11 = servo rate down
        await this.sendCommand(`SC,${parameter},${value}`);
    }

    // EBB Command: Set pen state
    async setPenState(state: 0 | 1, duration?: number): Promise<void> {
        console.log('Setting pen state to', state);
        // SP,<state>,<duration>
        // state: 0 = down (servo_min), 1 = up (servo_max)
        const dur = duration !== undefined ? duration : this.upDownDurationMs;
        const int_dur = Math.round(dur);
        await this.sendCommand(`SP,${state},${int_dur}`);
    }

    async penUp(duration?: number): Promise<void> {
        await this.setPenState(this.SP_PEN_UP_STATE, duration);
    }

    async penDown(duration?: number): Promise<void> {
        await this.setPenState(this.SP_PEN_DOWN_STATE, duration);
    }

    // EBB Command: Stepper move
    async stepperMove(duration: number, axis1Steps: number, axis2Steps: number): Promise<void> {
        // SM,<duration>,<axis1>,<axis2>
        // duration in milliseconds
        const axis1Steps_int = Math.round(axis1Steps);
        const axis2Steps_int = Math.round(axis2Steps);
        await this.sendCommand(`SM,${duration},${axis1Steps_int},${axis2Steps_int}`);
    }

    // EBB Command: Low-level move (rate-based)
    async lowLevelMove(rate: number, axis1Steps: number, axis2Steps: number): Promise<void> {
        // LM,<rate>,<axis1>,<axis2>
        // rate is the initial step rate in steps per second
        await this.sendCommand(`LM,${rate},${axis1Steps},${axis2Steps}`);
    }

    // EBB Command: Enable/disable motors
    async enableMotors(enable1: boolean, enable2: boolean): Promise<void> {
        // EM,<enable1>,<enable2>
        const e1 = enable1 ? 1 : 0;
        const e2 = enable2 ? 1 : 0;
        await this.sendCommand(`EM,${e1},${e2}`);
    }

    // EBB Command: Query general status
    async queryStatus(): Promise<void> {
        // QG - Query General
        await this.sendCommand('QG');
    }

    // EBB Command: Query motors position (legacy but still supported)
    async queryMotors(): Promise<void> {
        // QM - Query Motors (deprecated in v3.0+ but still works)
        await this.sendCommand('QM');
    }

    // High-level method to get current position
    async getCurrentPosition(): Promise<[number, number]> {
        // Query the current position from the EBB
        await this.queryStatus();
        // Return the position from our model (updated by response parsing)
        return this.model.getPosition();
    }

    // Set position to (0,0) - useful for connection initialization
    async setPositionToOrigin(): Promise<void> {
        // Reset the EBB hardware position tracking
        await this.reset();
        // Set our model position to (0,0)
        this.model.setPosition([0, 0]);
        console.log('Position set to origin (0,0)');
    }

    // EBB Command: Reset
    async reset(): Promise<void> {
        await this.sendCommand('R');
    }

    // High-level methods
    private updateUpDownDuration(): void {
        const diff = this.model.getPenUpPosition() - this.model.getPenDownPosition();
        this.upDownDurationMs = Math.abs(diff) * this.UP_DOWN_DELAY_SCALE;
    }

    async setPenUpValue(val: number): Promise<void> {
        this.model.setPenUpPosition(Math.round(val));
        await this.configureServo(this.PEN_UP_COMMAND, Math.round(val)); // SC parameter 4 = servo min (pen up)
        this.updateUpDownDuration();
    }

    async setPenDownValue(val: number): Promise<void> {
        this.model.setPenDownPosition(Math.round(val));
        await this.configureServo(this.PEN_DOWN_COMMAND, Math.round(val)); // SC parameter 5 = servo max (pen down)
        this.updateUpDownDuration();
    }

    setSpeedValue(val: number): void {
        this.model.setSpeed(val);
    }

    // Add new method for setting moving speed
    setMovingSpeedValue(val: number): void {
        this.model.setMovingSpeed(val);
    }

    // Update executeMove to use different speeds based on pen state
    async executeMove(dxSteps: number, dySteps: number, isPlotting: boolean = false): Promise<void> {
        // dxSteps and dySteps are world XY steps

        // Skip zero-length moves
        if (dxSteps === 0 && dySteps === 0) {
            return;
        }

        // Use different speeds based on whether we're plotting or just moving
        const speed = isPlotting ? this.model.getSpeed() : this.model.getMovingSpeed();

        // CoreXY forward kinematics: from machine XY steps to motor steps (A,B)
        const aSteps = dxSteps + dySteps;
        const bSteps = -dxSteps + dySteps;

        // Calculate duration based on the limiting motor distance to maintain feed rate
        const distance = Math.max(Math.abs(aSteps), Math.abs(bSteps));

        // Calculate duration based on speed
        const stepsPerSecond = (speed / 100) * this.MAX_STEPS_PER_SECOND;
        const duration = Math.max(1, Math.round((distance / stepsPerSecond) * 1000));
        await this.stepperMove(duration, aSteps, bSteps);
    }

    // Update moveTo to track pen state
    moveTo(p: [number, number], isPlotting: boolean = false): void {
        const currentPos = this.model.getPosition();

        // Convert from mm to step deltas
        const dxMm = p[0] - currentPos[0];
        const dyMm = p[1] - currentPos[1];
        const dxSteps = Math.round(dxMm * this.STEPS_PER_MM);
        const dySteps = Math.round(dyMm * this.STEPS_PER_MM);

        this.model.enqueue({ type: 'move', params: [dxSteps, dySteps, isPlotting] });
        this.model.setPosition(p);
    }


    // Update plotPath to use plotting speed for drawing moves
    plotPath(paths: [number, number][][], doLift: boolean = true): void {
        // Filter empty paths
        const validPaths = paths.filter(p => p.length > 0);

        console.log(`Plotting ${validPaths.length} paths`);

        // Compute per-job metrics before enqueuing
        let plannedCommands = 0;
        let penDownDistanceMm = 0;

        if (doLift && validPaths.length > 0) {
            plannedCommands += 1; // initial pen up
        }

        validPaths.forEach(path => {
            // travel move to start
            plannedCommands += 1; // moveTo start (not plotting)

            if (doLift) {
                plannedCommands += 1; // pen down
            }

            // draw segments
            for (let i = 1; i < path.length; i++) {
                plannedCommands += 1; // moveTo segment (plotting)
                const dx = path[i][0] - path[i - 1][0];
                const dy = path[i][1] - path[i - 1][1];
                penDownDistanceMm += Math.hypot(dx, dy);
            }

            if (doLift) {
                plannedCommands += 1; // pen up after path
            }
        });

        // Return to origin move
        plannedCommands += 1; // moveTo origin (not plotting)

        // Reset per-job counters and set job totals
        this.model.setCommandsSent(0);
        this.model.setCommandsCompleted(0);
        this.model.setTotalPlannedCommands(plannedCommands);
        this.model.setTotalDistanceDrawnMm(penDownDistanceMm);

        // Ensure pen is up before any travel moves
        if (doLift && validPaths.length > 0) {
            this.model.enqueue({ type: 'up' });
        }

        validPaths.forEach(path => {
            // Move to start position (not plotting)
            this.moveTo(path[0], false);

            if (doLift) {
                this.model.enqueue({ type: 'down' });
            }

            for (let i = 1; i < path.length; i++) {
                this.moveTo(path[i], true); // Draw the path (plotting)
            }

            if (doLift) {
                this.model.enqueue({ type: 'up' });
            }
        });

        // Return to origin after all paths are complete
        if (doLift && validPaths.length === 0) {
            // If there were no paths, still ensure pen is up
            this.model.enqueue({ type: 'up' });
        }

        this.moveTo([0, 0], false); // Return to origin (not plotting)

        this.model.setStartTime(new Date());

        console.log(`Queued ${this.model.getQueueLength()} commands, returning to origin`);
    }

    pause(): void {
        this.model.setPaused(true);
    }

    resume(): void {
        this.model.setPaused(false);
    }

    async disengage(): Promise<void> {
        await this.penUp();
        await this.enableMotors(false, false);
        this.stopQueueConsumption();
        this.stopStatusReading();
    }

    async consumeQueue(): Promise<void> {
        if (this.model.isPaused()) {
            return;
        }

        const commandsSent = this.model.getCommandsSent();
        const commandsCompleted = this.model.getCommandsCompleted();
        const queueLength = this.model.getQueueLength();
        const pending = commandsSent - commandsCompleted;

        // Only log when there's activity in the queue
        if (queueLength > 0) {
            console.log('Queue:', queueLength, 'Sent:', commandsSent, 'Completed:', commandsCompleted, 'Pending:', pending);
        }

        // Don't overflow the buffer - keep at most 50 commands pending
        if (pending < 50 && queueLength > 0) {
            // Process only 1-2 commands at a time for better flow control
            const batchSize = pending < 10 ? 2 : 1;

            for (let i = 0; i < batchSize; i++) {
                if (this.model.getQueueLength() > 0) {
                    const next = this.model.dequeue();
                    console.log('Dequeued command:', next);
                    if (next) {
                        switch (next.type) {
                            case 'move':
                                const isPlotting = next.params![2] || false; // Get plotting flag
                                await this.executeMove(next.params![0], next.params![1], isPlotting);
                                break;
                            case 'sm':
                                // params: [durationMs, axis1Steps, axis2Steps]
                                await this.stepperMove(next.params![0], next.params![1], next.params![2]);
                                break;
                            case 'up':
                                await this.penUp(this.upDownDurationMs);
                                break;
                            case 'down':
                                await this.penDown(this.upDownDurationMs);
                                break;
                            case 'query':
                                await this.queryStatus();
                                break;
                        }
                    }
                }
            }
        }

        // Check if queue is empty AFTER processing commands
        // Wait a bit longer to ensure all commands have been sent and plotter has time to execute
        if (queueLength === 0 && commandsSent > 0 && pending < 5) {
            if (!this.finishTimeout) {
                console.log('Plot complete! Queue empty, waiting for plotter to finish...');
                // Wait 2 more seconds to ensure plotter completes all movements
                this.finishTimeout = setTimeout(() => {
                    console.log('Stopping queue consumption.');
                    this.stopQueueConsumption();
                    this.finishTimeout = null;
                }, 2000);
            }
        }
    }

    startQueueConsumption(): void {
        if (!this.consumeQueueInterval) {
            // Increased from 10ms to 50ms for better flow control
            this.consumeQueueInterval = setInterval(() => {
                this.consumeQueue().catch(err => console.error('Queue consumption error:', err));
            }, 20);
        }
    }

    stopQueueConsumption(): void {
        if (this.consumeQueueInterval) {
            clearInterval(this.consumeQueueInterval);
            this.consumeQueueInterval = null;
        }
        if (this.finishTimeout) {
            clearTimeout(this.finishTimeout);
            this.finishTimeout = null;
        }
    }

    async readStatus(): Promise<void> {
        const commandsSent = this.model.getCommandsSent();
        const commandsCompleted = this.model.getCommandsCompleted();

        // Reduced from 500 to match consumeQueue limit
        if (commandsSent - commandsCompleted < 50) {
            await this.queryStatus();
        }
    }

    startStatusReading(): void {
        if (!this.readStatusInterval) {
            this.readStatusInterval = setInterval(() => {
                this.readStatus().catch(err => console.error('Status reading error:', err));
            }, 100);
        }
    }

    stopStatusReading(): void {
        if (this.readStatusInterval) {
            clearInterval(this.readStatusInterval);
            this.readStatusInterval = null;
        }
    }

    getModel(): AxidrawModel {
        return this.model;
    }
}

