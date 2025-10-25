import { PlotModel } from "../models/PlotModel.js";

type Models = {
    plot: PlotModel;
};

interface AppModelState {
    version: number;
    plot?: unknown;
}

export class PersistenceController {
    private models: Models;
    private saveTimer: number | null = null;
    private readonly saveDebounceMs = 300;

    constructor(models: Models) {
        this.models = models;
        // Auto-save on any plot model change
        this.models.plot.subscribe(() => this.scheduleSave());
    }

    async load(): Promise<void> {
        try {
            const result = await window.electronAPI.loadAppModel();
            if (!(result && result.success && result.jsonString)) return;
            const parsed: AppModelState = JSON.parse(result.jsonString);
            if (parsed && parsed.plot) {
                this.models.plot.replaceState(parsed.plot);
            }
        } catch (err) {
            console.error('Failed to load app model:', err);
        }
    }

    async saveNow(): Promise<void> {
        try {
            const state: AppModelState = {
                version: 1,
                plot: this.models.plot.getState() as any,
            };
            const json = JSON.stringify(state, this.replacer, 0);
            await window.electronAPI.saveAppModel(json);
        } catch (err) {
            console.error('Failed to save app model:', err);
        }
    }

    private scheduleSave(): void {
        if (this.saveTimer !== null) {
            window.clearTimeout(this.saveTimer);
        }
        this.saveTimer = window.setTimeout(() => {
            this.saveTimer = null;
            this.saveNow();
        }, this.saveDebounceMs);
    }

    private replacer(_key: string, value: unknown): unknown {
        // Dates
        if (value instanceof Date) {
            return { __type: 'Date', value: value.toISOString() };
        }
        // Typed arrays
        if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
            const typedArray = value as unknown as { constructor: { name: string }; length: number;[index: number]: number };
            const constructorName = typedArray.constructor.name;
            const data: number[] = Array.from(typedArray as unknown as number[]);
            return { __type: 'TypedArray', constructorName, data };
        }
        // ArrayBuffer
        if (value instanceof ArrayBuffer) {
            const data = Array.from(new Uint8Array(value));
            return { __type: 'ArrayBuffer', data };
        }
        return value as any;
    }
}


