import type { FilterDefinition, FilterIoKind, FilterContext } from '../../../types';

type Params = {
    step: number; // spacing between parallel lines in pixels
    angle: number; // degrees, direction of hatch lines
    threshold: number; // 0..255, pixels darker than this are drawn
};

// Crosshatch lines in up to 4 directions: 45°, -45°, vertical, horizontal
export const LineHatchFilter: FilterDefinition<Params, FilterIoKind, 'paths'> = {
    id: 'line-hatch',
    label: 'Line Hatch',
    entityKind: 'paths',
    inputKinds: ['raster', 'bitmap'],
    outputKind: 'paths',
    defaultParams: { step: 8, angle: 45, threshold: 128 },
    paramsSchema: [
        { key: 'step', label: 'Spacing', type: 'number', min: 1, max: 64, step: 1 },
        { key: 'angle', label: 'Angle (deg)', type: 'number', min: -180, max: 180, step: 1 },
        { key: 'threshold', label: 'Threshold', type: 'number', min: 0, max: 255, step: 1 }
    ],
    async apply(input, params, ctx: FilterContext) {
        const src = input as ImageData;
        const { width, height, data } = src;
        const step = Math.max(1, Math.floor(params.step));
        const angle = ((params.angle % 360) + 360) % 360; // 0..360
        const theta = angle * Math.PI / 180;
        const dx = Math.cos(theta), dy = Math.sin(theta);
        const nx = -dy, ny = dx; // perpendicular unit
        const thr = Math.max(0, Math.min(255, Math.floor(params.threshold)));

        const paths: [number, number][][] = [];

        const isDark = (x: number, y: number): boolean => {
            if (x < 0 || y < 0 || x >= width || y >= height) return false;
            const v = data[(y * width + x) * 4];
            return v <= thr;
        };

        // Project rectangle corners on normal to get scan range
        const corners: [number, number][] = [[0, 0], [width, 0], [width, height], [0, height]];
        let sMin = Infinity, sMax = -Infinity;
        for (const [cx, cy] of corners) {
            const s = cx * nx + cy * ny;
            if (s < sMin) sMin = s;
            if (s > sMax) sMax = s;
        }

        const eps = 1e-6;
        const addIntersections = (s: number): [number, number][] => {
            const pts: [number, number][] = [];
            // x = 0 and x = width
            if (Math.abs(ny) > eps) {
                const y0 = (s - nx * 0) / ny;
                if (y0 >= 0 && y0 <= height) pts.push([0, y0]);
                const yW = (s - nx * width) / ny;
                if (yW >= 0 && yW <= height) pts.push([width, yW]);
            }
            // y = 0 and y = height
            if (Math.abs(nx) > eps) {
                const x0 = (s - ny * 0) / nx;
                if (x0 >= 0 && x0 <= width) pts.push([x0, 0]);
                const xH = (s - ny * height) / nx;
                if (xH >= 0 && xH <= width) pts.push([xH, height]);
            }
            // Deduplicate close points
            const unique: [number, number][] = [];
            for (const p of pts) {
                if (!unique.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-3)) unique.push(p);
            }
            return unique.slice(0, 2);
        };

        // Emit contiguous runs for a single segment
        const emitRuns = (a: [number, number], b: [number, number]): void => {
            const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (L < 1) return;
            const samples = Math.max(2, Math.ceil(L));
            let runStart: number | null = null;
            for (let i = 0; i < samples; i++) {
                const t = i / (samples - 1);
                const px = a[0] + (b[0] - a[0]) * t;
                const py = a[1] + (b[1] - a[1]) * t;
                const xi = Math.max(0, Math.min(width - 1, Math.floor(px)));
                const yi = Math.max(0, Math.min(height - 1, Math.floor(py)));
                if (isDark(xi, yi)) {
                    if (runStart === null) runStart = i;
                } else if (runStart !== null) {
                    const t0 = runStart / (samples - 1);
                    const t1 = (i - 1) / (samples - 1);
                    const p0: [number, number] = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
                    const p1: [number, number] = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
                    paths.push([[p0[0], height - p0[1]], [p1[0], height - p1[1]]]);
                    runStart = null;
                }
                if (((i & 1023) === 0)) {
                    try { ctx.onProgress?.(Math.min(0.99, i / samples)); } catch { }
                }
            }
            if (runStart !== null) {
                const t0 = runStart / (samples - 1);
                const p0: [number, number] = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
                const p1: [number, number] = [b[0], b[1]];
                paths.push([[p0[0], height - p0[1]], [p1[0], height - p1[1]]]);
            }
        };

        // Sweep across the image with parallel lines spaced by `step` along the normal
        for (let s = Math.floor(sMin); s <= Math.ceil(sMax); s += step) {
            const ints = addIntersections(s);
            if (ints.length < 2) continue;
            const a = ints[0], b = ints[1];
            emitRuns(a, b);
            if (ctx.abortSignal?.aborted) return paths as any;
        }

        try { ctx.onProgress?.(1); } catch { }
        return paths as any;
    }
};

export default LineHatchFilter;


