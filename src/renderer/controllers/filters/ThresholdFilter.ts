import type { FilterDefinition, FilterIoKind } from '../../../types';

type Params = { threshold: number };

export const ThresholdFilter: FilterDefinition<Params, FilterIoKind, 'bitmap'> = {
    id: 'threshold',
    label: 'Threshold',
    entityKind: 'bitmap',
    inputKinds: ['raster', 'bitmap'],
    outputKind: 'bitmap',
    defaultParams: { threshold: 0.5 },
    paramsSchema: [
        { key: 'threshold', label: 'Threshold', type: 'number', min: 0, max: 1, step: 0.01 }
    ],
    apply(input, params) {
        const src = input as ImageData;
        const { width, height, data } = src;
        const out = new Uint8ClampedArray(width * height * 4);
        const t = Math.max(0, Math.min(1, params.threshold));
        const t255 = Math.round(t * 255);
        for (let i = 0; i < width * height; i++) {
            const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
            const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            const bin = v <= t255 ? 0 : 255;
            out[i * 4 + 0] = bin;
            out[i * 4 + 1] = bin;
            out[i * 4 + 2] = bin;
            out[i * 4 + 3] = 255;
        }
        return new ImageData(out, width, height);
    }
};

export default ThresholdFilter;


