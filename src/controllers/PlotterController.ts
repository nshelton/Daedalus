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
        if (response === 'OK') {
            this.model.setCommandsCompleted(this.model.getCommandsCompleted() + 1);
        }

        // Handle query responses (e.g., "QG,0,0,0")
        // Can be extended to parse specific responses as needed
        console.log('EBB Response:', response);
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
        const dx = Math.round(p[0] - currentPos[0]);
        const dy = Math.round(p[1] - currentPos[1]);

        this.model.enqueue({ type: 'move', params: [dx, dy] });
        this.model.setPosition(p);
    }

    plotPath(paths: [number, number][][], doLift: boolean = true): void {
        // Filter empty paths
        const validPaths = paths.filter(p => p.length > 0);

        validPaths.forEach(path => {
            this.moveTo(path[0]);

            if (doLift) {
                this.model.enqueue({ type: 'down' });
            }

            for (let i = 1; i < path.length; i++) {
                this.moveTo(path[i]);
            }

            if (doLift) {
                this.model.enqueue({ type: 'up' });
            }
        });

        this.moveTo([0, 0]);
        this.model.setStartTime(new Date());
    }

    async executeMove(dx: number, dy: number): Promise<void> {
        const speed = this.model.getSpeed();
        const distance = Math.sqrt(dx * dx + dy * dy);
        const duration = Math.max(1, Math.round((distance / speed) * 1000));

        await this.stepperMove(duration, dx, dy);
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

        console.log('commandsSent:', commandsSent, 'commandsCompleted:', commandsCompleted);

        // Don't overflow the buffer - keep at most 500 commands pending
        if (commandsSent - commandsCompleted < 500) {
            // Process up to 10 commands at once
            for (let i = 0; i < 10; i++) {
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
    }

    startQueueConsumption(): void {
        if (!this.consumeQueueInterval) {
            this.consumeQueueInterval = setInterval(() => {
                this.consumeQueue().catch(err => console.error('Queue consumption error:', err));
            }, 10);
        }
    }

    stopQueueConsumption(): void {
        if (this.consumeQueueInterval) {
            clearInterval(this.consumeQueueInterval);
            this.consumeQueueInterval = null;
        }
    }

    async readStatus(): Promise<void> {
        const commandsSent = this.model.getCommandsSent();
        const commandsCompleted = this.model.getCommandsCompleted();

        if (commandsSent - commandsCompleted < 500) {
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

