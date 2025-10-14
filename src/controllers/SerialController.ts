import { SerialPort } from 'serialport';
import { SerialModel } from '../models/SerialModel';

export class SerialController {
    private model: SerialModel;
    private port: SerialPort | null = null;
    private dataCallback: ((data: string) => void) | null = null;

    constructor(model: SerialModel) {
        this.model = model;
    }

    async listPorts() {
        try {
            const ports = await SerialPort.list();
            this.model.setAvailablePorts(ports);
            this.model.setLastError(null);
            return ports;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.model.setLastError(errorMsg);
            throw error;
        }
    }

    async findPlotterPort() {
        const ports = await this.listPorts();

        console.log('Ports:', ports);

        // Look for EiBotBoard (Microchip-based plotter)
        const plotterPort = ports.find(port => {
            const vendorId = port.vendorId?.toUpperCase() || '';
            const productId = port.productId?.toUpperCase() || '';

            return (
                vendorId === '04D8' && productId === 'FD92' // EiBotBoard
            );
        });

        return plotterPort;
    }

    async connect(portPath: string, baudRate: number = 115200): Promise<void> {
        if (this.model.isConnected()) {
            await this.disconnect();
        }

        return new Promise((resolve, reject) => {
            try {
                this.port = new SerialPort({
                    path: portPath,
                    baudRate,
                    autoOpen: false
                });

                this.port.on('open', () => {
                    this.model.setConnected(true);
                    this.model.setPortPath(portPath);
                    this.model.setBaudRate(baudRate);
                    this.model.setLastError(null);
                    resolve();
                });

                this.port.on('error', (error) => {
                    const errorMsg = error.message;
                    this.model.setLastError(errorMsg);
                    this.model.setConnected(false);
                    reject(error);
                });

                this.port.on('close', () => {
                    this.model.setConnected(false);
                    this.model.setPortPath(null);
                });

                this.port.on('data', (data: Buffer) => {
                    if (this.dataCallback) {
                        this.dataCallback(data.toString('utf8'));
                    }
                });

                this.port.open();
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                this.model.setLastError(errorMsg);
                reject(error);
            }
        });
    }

    async disconnect(): Promise<void> {
        if (!this.port || !this.port.isOpen) {
            this.model.setConnected(false);
            this.model.setPortPath(null);
            return;
        }

        return new Promise((resolve, reject) => {
            this.port!.close((error) => {
                if (error) {
                    const errorMsg = error.message;
                    this.model.setLastError(errorMsg);
                    reject(error);
                } else {
                    this.model.setConnected(false);
                    this.model.setPortPath(null);
                    this.model.setLastError(null);
                    this.port = null;
                    resolve();
                }
            });
        });
    }

    onData(callback: (data: string) => void): void {
        this.dataCallback = callback;
    }

    async write(data: string | Buffer): Promise<void> {
        if (!this.port || !this.port.isOpen) {
            throw new Error('Port is not open');
        }

        return new Promise((resolve, reject) => {
            this.port!.write(data, (error) => {
                if (error) {
                    const errorMsg = error.message;
                    this.model.setLastError(errorMsg);
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    getModel(): SerialModel {
        return this.model;
    }
}

