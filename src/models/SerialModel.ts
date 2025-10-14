interface PortInfo {
    path: string;
    manufacturer?: string;
    serialNumber?: string;
    pnpId?: string;
    locationId?: string;
    productId?: string;
    vendorId?: string;
}

interface SerialState {
    isConnected: boolean;
    portPath: string | null;
    baudRate: number;
    availablePorts: PortInfo[];
    lastError: string | null;
}

export class SerialModel {
    private state: SerialState = {
        isConnected: false,
        portPath: null,
        baudRate: 115200,
        availablePorts: [],
        lastError: null
    };

    getState(): Readonly<SerialState> {
        return { ...this.state };
    }

    setConnected(isConnected: boolean): void {
        this.state.isConnected = isConnected;
    }

    setPortPath(portPath: string | null): void {
        this.state.portPath = portPath;
    }

    setBaudRate(baudRate: number): void {
        this.state.baudRate = baudRate;
    }

    setAvailablePorts(ports: PortInfo[]): void {
        this.state.availablePorts = ports;
    }

    setLastError(error: string | null): void {
        this.state.lastError = error;
    }

    isConnected(): boolean {
        return this.state.isConnected;
    }

    getPortPath(): string | null {
        return this.state.portPath;
    }

    getBaudRate(): number {
        return this.state.baudRate;
    }

    getAvailablePorts(): PortInfo[] {
        return [...this.state.availablePorts];
    }

    getLastError(): string | null {
        return this.state.lastError;
    }

    reset(): void {
        this.state = {
            isConnected: false,
            portPath: null,
            baudRate: 115200,
            availablePorts: [],
            lastError: null
        };
    }
}

