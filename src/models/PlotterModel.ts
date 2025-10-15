interface PlotCommand {
    type: 'move' | 'up' | 'down' | 'query' | 'reset';
    params?: any[];
}

export interface PlotEntity {
    id: string;
    paths: [number, number][][]; // Array of paths, each path is array of [x, y] points
}

interface PlotterState {
    position: [number, number];
    penUpPosition: number;
    penDownPosition: number;
    speed: number;
    isPaused: boolean;
    commandsSent: number;
    commandsCompleted: number;
    queue: PlotCommand[];
    startTime: Date | null;
    entities: PlotEntity[];
}

export class PlotterModel {
    private state: PlotterState = {
        position: [0, 0],
        penUpPosition: 16000,  // Default from EBB docs (1.33ms)
        penDownPosition: 12000, // Typical down position
        speed: 1000,
        isPaused: false,
        commandsSent: 0,
        commandsCompleted: 0,
        queue: [],
        startTime: null,
        entities: []
    };

    getState(): Readonly<PlotterState> {
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

    getQueue(): PlotCommand[] {
        return [...this.state.queue];
    }

    enqueue(command: PlotCommand): void {
        this.state.queue.push(command);
    }

    dequeue(): PlotCommand | undefined {
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
            isPaused: false,
            commandsSent: 0,
            commandsCompleted: 0,
            queue: [],
            startTime: null,
            entities: this.state.entities // Keep entities
        };
    }

    // Entity management
    getEntities(): PlotEntity[] {
        return [...this.state.entities];
    }

    addEntity(entity: PlotEntity): void {
        this.state.entities.push(entity);
    }

    updateEntity(id: string, updates: Partial<PlotEntity>): void {
        const idx = this.state.entities.findIndex(e => e.id === id);
        if (idx !== -1) {
            this.state.entities[idx] = { ...this.state.entities[idx], ...updates };
        }
    }

    removeEntity(id: string): void {
        this.state.entities = this.state.entities.filter(e => e.id !== id);
    }

    getEntity(id: string): PlotEntity | undefined {
        return this.state.entities.find(e => e.id === id);
    }
}

