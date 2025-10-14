import { SerialController } from './SerialController';
import { PlotterModel } from '../models/PlotterModel';

export class PlotterController {
    private model: PlotterModel;
    private serialController: SerialController;
    private responseBuffer: string = '';
    private upDownDurationMs: number = 100;
    private readonly UP_DOWN_DELAY_SCALE = 0.06;
    private consumeQueueInterval: NodeJS.Timeout | null = null;
    private readStatusInterval: NodeJS.Timeout | null = null;
    private finishTimeout: NodeJS.Timeout | null = null;

    // EiBotBoard/AxiDraw has 2032 steps per inch = 80 steps per mm
    private readonly STEPS_PER_MM = 80;

    constructor(model: PlotterModel, serialController: SerialController) {
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
        } else if (response.trim().length > 0) {
            // Handle other responses (e.g., "QG,0,0,0")
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
        // parameter 4 = servo min (pen up)
        // parameter 5 = servo max (pen down)
        // parameter 10 = servo rate up
        // parameter 11 = servo rate down
        await this.sendCommand(`SC,${parameter},${value}`);
    }

    // EBB Command: Set pen state
    async setPenState(state: 0 | 1, duration?: number): Promise<void> {
        // SP,<state>,<duration>
        // state: 0 = up, 1 = down
        const dur = duration !== undefined ? duration : this.upDownDurationMs;
        await this.sendCommand(`SP,${state},${dur}`);
    }

    async penUp(duration?: number): Promise<void> {
        await this.setPenState(0, duration);
    }

    async penDown(duration?: number): Promise<void> {
        await this.setPenState(1, duration);
    }

    // EBB Command: Stepper move
    async stepperMove(duration: number, axis1Steps: number, axis2Steps: number): Promise<void> {
        // SM,<duration>,<axis1>,<axis2>
        // duration in milliseconds
        await this.sendCommand(`SM,${duration},${axis1Steps},${axis2Steps}`);
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
        await this.configureServo(5, Math.round(val)); // SC parameter 5 = pen up position
        this.updateUpDownDuration();
    }

    async setPenDownValue(val: number): Promise<void> {
        this.model.setPenDownPosition(Math.round(val));
        await this.configureServo(4, Math.round(val)); // SC parameter 4 = pen down position
        this.updateUpDownDuration();
    }

    setSpeedValue(val: number): void {
        this.model.setSpeed(val);
    }

    moveTo(p: [number, number]): void {
        const currentPos = this.model.getPosition();

        // Convert from mm to motor steps
        const dxMm = p[0] - currentPos[0];
        const dyMm = p[1] - currentPos[1];
        const dxSteps = Math.round(dxMm * this.STEPS_PER_MM);
        const dySteps = Math.round(dyMm * this.STEPS_PER_MM);

        this.model.enqueue({ type: 'move', params: [dxSteps, dySteps] });
        this.model.setPosition(p);
    }

    plotPath(paths: [number, number][][], doLift: boolean = true): void {
        // Filter empty paths
        const validPaths = paths.filter(p => p.length > 0);

        console.log(`Plotting ${validPaths.length} paths`);

        validPaths.forEach(path => {
            if (doLift) {
                this.model.enqueue({ type: 'up' }); // Pen up first
            }

            this.moveTo(path[0]); // Move to start position

            if (doLift) {
                this.model.enqueue({ type: 'down' }); // Pen down
            }

            for (let i = 1; i < path.length; i++) {
                this.moveTo(path[i]); // Draw the path
            }

            if (doLift) {
                this.model.enqueue({ type: 'up' }); // Pen up after drawing
            }
        });

        // Return to origin after all paths are complete
        if (doLift) {
            this.model.enqueue({ type: 'up' }); // Make sure pen is up
        }
        this.moveTo([0, 0]); // Return to origin (0, 0)

        this.model.setStartTime(new Date());

        console.log(`Queued ${this.model.getQueueLength()} commands, returning to origin`);
    }

    async executeMove(dxSteps: number, dySteps: number): Promise<void> {
        // dxSteps and dySteps are already in motor steps

        // Skip zero-length moves
        if (dxSteps === 0 && dySteps === 0) {
            return;
        }

        const speed = this.model.getSpeed(); // Speed as percentage 1-100
        const distance = Math.sqrt(dxSteps * dxSteps + dySteps * dySteps);

        // Calculate duration based on speed
        // At 100% speed, aim for ~25000 steps/second (AxiDraw max)
        // This is much faster and more practical
        const maxStepsPerSecond = 25000;
        const stepsPerSecond = (speed / 100) * maxStepsPerSecond;
        const duration = Math.max(1, Math.round((distance / stepsPerSecond) * 1000));

        await this.stepperMove(duration, dxSteps, dySteps);
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
                    if (next) {
                        switch (next.type) {
                            case 'move':
                                await this.executeMove(next.params![0], next.params![1]);
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
            }, 50);
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

    getModel(): PlotterModel {
        return this.model;
    }
}

