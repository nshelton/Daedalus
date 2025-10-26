import type { FilterDefinition, FilterIoKind } from '../../../types';

type Params = { factor: number; method: 'nearest' | 'average' };

export const DownsampleFilter: FilterDefinition<Params, FilterIoKind, 'bitmap'> = {
    id: 'downsample',
    label: 'Downsample',
    entityKind: 'bitmap',
    inputKinds: ['raster', 'bitmap'],
    outputKind: 'bitmap',
    defaultParams: { factor: 2, method: 'average' },
    paramsSchema: [
        { key: 'factor', label: 'Factor', type: 'number', min: 1, max: 16, step: 1 },
        {
            key: 'method', label: 'Method', type: 'enum', options: [
                { label: 'Average', value: 'average' },
                { label: 'Nearest', value: 'nearest' }
            ]
        }
    ],
    apply(input, params) {
        const src = input as ImageData;
        const factor = Math.max(1, Math.min(16, Math.floor(params.factor)));
        if (factor === 1) return src;
        const { width, height, data } = src;
        const outW = Math.max(1, Math.floor(width / factor));
        const outH = Math.max(1, Math.floor(height / factor));
        const out = new Uint8ClampedArray(outW * outH * 4);

        if (params.method === 'nearest') {
            for (let y = 0; y < outH; y++) {
                const sy = Math.min(height - 1, y * factor);
                for (let x = 0; x < outW; x++) {
                    const sx = Math.min(width - 1, x * factor);
                    const si = (sy * width + sx) * 4;
                    const di = (y * outW + x) * 4;
                    out[di] = data[si];
                    out[di + 1] = data[si + 1];
                    out[di + 2] = data[si + 2];
                    out[di + 3] = 255;
                }
            }
            return new ImageData(out, outW, outH);
        }

        // Average (box filter)
        for (let y = 0; y < outH; y++) {
            const y0 = y * factor;
            const y1 = Math.min(height, y0 + factor);
            for (let x = 0; x < outW; x++) {
                const x0 = x * factor;
                const x1 = Math.min(width, x0 + factor);
                let sr = 0, sg = 0, sb = 0, count = 0;
                for (let yy = y0; yy < y1; yy++) {
                    let idx = (yy * width + x0) * 4;
                    for (let xx = x0; xx < x1; xx++) {
                        sr += data[idx];
                        sg += data[idx + 1];
                        sb += data[idx + 2];
                        count++;
                        idx += 4;
                    }
                }
                const di = (y * outW + x) * 4;
                out[di] = Math.round(sr / count);
                out[di + 1] = Math.round(sg / count);
                out[di + 2] = Math.round(sb / count);
                out[di + 3] = 255;
            }
        }
        return new ImageData(out, outW, outH);
    }
};

export default DownsampleFilter;


