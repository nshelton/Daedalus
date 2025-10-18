interface AxidrawCommand {
    type: 'move' | 'up' | 'down' | 'query' | 'reset';
    params?: any[];
}

interface AxidrawState {
    position: [number, number];
    penUpPosition: number;
    penDownPosition: number;
    speed: number;
    movingSpeed: number;
    isPaused: boolean;
    commandsSent: number;
    commandsCompleted: number;
    queue: AxidrawCommand[];
    startTime: Date | null;
}

export class AxidrawModel {
    private state: AxidrawState = {
        position: [0, 0],
        penUpPosition: 16000,  // Default from EBB docs (1.33ms)
        penDownPosition: 12000, // Typical down position
        speed: 1000,
        movingSpeed: 2000, // Default moving speed (faster than plotting)
        isPaused: false,
        commandsSent: 0,
        commandsCompleted: 0,
        queue: [],
        startTime: null
    };

    getState(): Readonly<AxidrawState> {
        return { ...this.state, queue: [...this.state.queue] };
    }

    getPosition(): [number, number] {
        return [...this.state.position] as [number, number];
    }

    setPosition(pos: [number, number]): void {
        this.state.position = pos;
    }

    getPenUpPosition(): number {
        return this.state.penUpPosition;
    }

    setPenUpPosition(val: number): void {
        this.state.penUpPosition = val;
    }

    getPenDownPosition(): number {
        return this.state.penDownPosition;
    }

    setPenDownPosition(val: number): void {
        this.state.penDownPosition = val;
    }

    getSpeed(): number {
        return this.state.speed;
    }

    setSpeed(val: number): void {
        this.state.speed = val;
    }

    getMovingSpeed(): number {
        return this.state.movingSpeed;
    }

    setMovingSpeed(val: number): void {
        this.state.movingSpeed = val;
    }

    isPaused(): boolean {
        return this.state.isPaused;
    }

    setPaused(paused: boolean): void {
        this.state.isPaused = paused;
    }

    getCommandsSent(): number {
        return this.state.commandsSent;
    }

    incrementCommandsSent(): void {
        this.state.commandsSent++;
    }

    getCommandsCompleted(): number {
        return this.state.commandsCompleted;
    }

    setCommandsCompleted(count: number): void {
        this.state.commandsCompleted = count;
    }

    getQueue(): AxidrawCommand[] {
        return [...this.state.queue];
    }

    enqueue(command: AxidrawCommand): void {
        this.state.queue.push(command);
    }

    dequeue(): AxidrawCommand | undefined {
        return this.state.queue.shift();
    }

    clearQueue(): void {
        this.state.queue = [];
    }

    getQueueLength(): number {
        return this.state.queue.length;
    }

    getStartTime(): Date | null {
        return this.state.startTime;
    }

    setStartTime(time: Date | null): void {
        this.state.startTime = time;
    }

    reset(): void {
        this.state = {
            position: [0, 0],
            penUpPosition: this.state.penUpPosition, // Keep settings
            penDownPosition: this.state.penDownPosition,
            speed: this.state.speed,
            movingSpeed: this.state.movingSpeed, // Keep moving speed setting
            isPaused: false,
            commandsSent: 0,
            commandsCompleted: 0,
            queue: [],
            startTime: null
        };
    }
}

