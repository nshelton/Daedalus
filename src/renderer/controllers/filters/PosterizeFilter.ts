import type { FilterDefinition, FilterIoKind } from '../../../types';

type Params = { levels: number };

export const PosterizeFilter: FilterDefinition<Params, FilterIoKind, 'bitmap'> = {
    id: 'posterize',
    label: 'Posterize',
    entityKind: 'bitmap',
    inputKinds: ['raster', 'bitmap'],
    outputKind: 'bitmap',
    defaultParams: { levels: 4 },
    paramsSchema: [
        { key: 'levels', label: 'Levels', type: 'number', min: 2, max: 16, step: 1 }
    ],
    apply(input, params) {
        const src = input as ImageData;
        const { width, height, data } = src;
        const out = new Uint8ClampedArray(width * height * 4);
        const levels = Math.max(2, Math.min(16, params.levels));
        const step = 255 / (levels - 1);
        for (let i = 0; i < width * height; i++) {
            const value = Math.round(data[i * 4] / step) * step;
            out[i * 4 + 0] = value;
            out[i * 4 + 1] = value;
            out[i * 4 + 2] = value;
            out[i * 4 + 3] = 255;
        }
        return new ImageData(out, width, height);
    }
};

export default PosterizeFilter;


