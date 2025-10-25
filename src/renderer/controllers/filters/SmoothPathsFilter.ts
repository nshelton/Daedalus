import type { FilterDefinition, PathLike } from '../../../types';

type Params = { passes: number; alpha: number };

function isClosed(path: PathLike): boolean {
    if (path.length < 3) return false;
    const [x0, y0] = path[0];
    const [xn, yn] = path[path.length - 1];
    const dx = x0 - xn;
    const dy = y0 - yn;
    return (dx * dx + dy * dy) <= 1;
}

function smoothOnce(path: PathLike, closed: boolean, alpha: number): PathLike {
    const n = path.length;
    if (n < 3) return path;
    const out = new Array<[number, number]>(n);
    if (!closed) {
        out[0] = path[0];
        out[n - 1] = path[n - 1];
    } else {

        const [ax, ay] = path[1];
        const [bx, by] = path[n - 2];
        const targetPoint = [(ax + bx) / 2, (ay + by) / 2];

        const [a0x, a0y] = path[0];
        const [anx, any] = path[n - 1];
        const avgpoint = [(a0x + anx) / 2, (a0y + any) / 2];

        out[0] = [avgpoint[0] * (1 - alpha) + targetPoint[0] * alpha, avgpoint[1] * (1 - alpha) + targetPoint[1] * alpha];
        out[n - 1] = [avgpoint[0] * (1 - alpha) + targetPoint[0] * alpha, avgpoint[1] * (1 - alpha) + targetPoint[1] * alpha];
    }

    for (let i = 1; i < n - 1; i++) {

        const [ax, ay] = path[i - 1];
        const [bx, by] = path[i + 1];
        const targetPoint = [(ax + bx) / 2, (ay + by) / 2];
        const avgpoint = path[i];
        out[i] = [avgpoint[0] * (1 - alpha) + targetPoint[0] * alpha, avgpoint[1] * (1 - alpha) + targetPoint[1] * alpha];
    }
    return out;
}

function smoothPath(path: PathLike, passes: number, alpha: number): PathLike {
    if (path.length < 3) return path;
    const closed = isClosed(path);
    let cur = path;
    const iter = Math.max(1, Math.floor(Number.isFinite(passes) ? passes : 1));
    for (let k = 0; k < iter; k++) {
        cur = smoothOnce(cur, closed, alpha);
    }
    return cur;
}

export const SmoothPathsFilter: FilterDefinition<Params, 'paths', 'paths'> = {
    id: 'smoothPaths',
    label: 'Smooth Paths',
    entityKind: 'paths',
    inputKinds: ['paths'],
    outputKind: 'paths',
    defaultParams: { passes: 1, alpha: 0.5 },
    paramsSchema: [
        { key: 'passes', label: 'Passes', type: 'number', min: 1, max: 10, step: 1 },
        { key: 'alpha', label: 'Alpha', type: 'number', min: 0, max: 1, step: 0.01 }
    ],
    async apply(input, params) {
        const passes = Math.max(1, Math.floor(Number(params.passes) || 1));
        const alpha = Math.max(0, Math.min(1, Number(params.alpha) || 0.5));
        const src = input as PathLike[];
        return src.map(p => smoothPath(p, passes, alpha)) as any;
    }
};

export default SmoothPathsFilter;


