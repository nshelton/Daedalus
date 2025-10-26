import type { FilterDefinition, FilterIoKind } from '../../../types';

type Params = { brightness: number; contrast: number, invert: boolean };

export const LevelsFilter: FilterDefinition<Params, FilterIoKind, 'bitmap'> = {
    id: 'levels',
    label: 'Levels',
    entityKind: 'bitmap',
    inputKinds: ['raster', 'bitmap'],
    outputKind: 'bitmap',
    defaultParams: { brightness: 0, contrast: 0, invert: false },
    paramsSchema: [
        { key: 'brightness', label: 'Brightness', type: 'number', min: -1, max: 1, step: 0.01 },
        { key: 'contrast', label: 'Contrast', type: 'number', min: -1, max: 1, step: 0.01 },
        { key: 'invert', label: 'Invert', type: 'boolean' }
    ],
    apply(input, params) {
        const src = input as ImageData;
        const { width, height, data } = src;
        const out = new Uint8ClampedArray(width * height * 4);
        const b = Math.max(-1, Math.min(1, params.brightness)) * 255;
        const c = Math.max(-1, Math.min(1, params.contrast));
        const cf = 1 + c; // contrast factor
        for (let i = 0; i < width * height; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b0 = data[i * 4 + 2];
            let nr = Math.max(0, Math.min(255, Math.round((r - 128) * cf + 128 + b)));
            let ng = Math.max(0, Math.min(255, Math.round((g - 128) * cf + 128 + b)));
            let nb = Math.max(0, Math.min(255, Math.round((b0 - 128) * cf + 128 + b)));
            if (params.invert) {
                nr = 255 - nr;
                ng = 255 - ng;
                nb = 255 - nb;
            }
            out[i * 4] = nr;
            out[i * 4 + 1] = ng;
            out[i * 4 + 2] = nb;
            out[i * 4 + 3] = 255;
        }
        return new ImageData(out, width, height);
    }
};

export default LevelsFilter;


