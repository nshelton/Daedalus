import type { FilterDefinition, FilterContext, PathLike } from '../../../types';

type Params = { angleLimitDeg: number; maxSegmentLen: number };

let wasmMod: any | null = null;
async function getWasm(): Promise<any | null> {
    try {
        if (!wasmMod) {
            const spec = new URL('dist/native/subdivide.mjs', document.baseURI).href;
            const init = (await import(spec)).default as (opts?: any) => Promise<any>;
            wasmMod = await init();
        }
        return wasmMod;
    } catch (err) {
        console.warn('Subdivide WASM init failed; using JS no-op', err);
        return null;
    }
}

function toFlatXY(path: PathLike): Float64Array {
    const n = path.length;
    const flat = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
        const p = path[i];
        flat[i * 2] = p[0];
        flat[i * 2 + 1] = p[1];
    }
    return flat;
}

function toPairs(flat: Float64Array): PathLike {
    const out: PathLike = new Array(flat.length / 2);
    for (let i = 0, j = 0; i < flat.length; i += 2, j++) out[j] = [flat[i], flat[i + 1]];
    return out;
}

async function subdividePathWasm(path: PathLike, angleLimitDeg: number, maxSegmentLen: number): Promise<PathLike> {
    const mod = await getWasm();
    if (!mod || path.length === 0) return path;
    const xy = toFlatXY(path);
    const bytesXY = xy.length * 8;
    const ptrXY = mod._malloc(bytesXY);
    mod.HEAPF64.set(xy, ptrXY >>> 3);
    const ptrOutLen = mod._malloc(4);
    const retPtr = mod._subdivide_path(ptrXY, path.length | 0, angleLimitDeg || 0, maxSegmentLen || 0, ptrOutLen);
    const outLenPts = mod.HEAP32[(ptrOutLen | 0) >> 2] | 0;
    let result: PathLike = path;
    if (retPtr && outLenPts > 0) {
        const countDoubles = outLenPts * 2;
        const outSlice = mod.HEAPF64.subarray((retPtr | 0) >>> 3, ((retPtr | 0) >>> 3) + countDoubles);
        const copy = new Float64Array(countDoubles);
        copy.set(outSlice);
        result = toPairs(copy);
        mod._free(retPtr);
    }
    mod._free(ptrXY);
    mod._free(ptrOutLen);
    return result;
}

export const SubdividePathsFilter: FilterDefinition<Params, 'paths', 'paths'> = {
    id: 'subdividePaths',
    label: 'Subdivide Paths (WASM)',
    entityKind: 'paths',
    inputKinds: ['paths'],
    outputKind: 'paths',
    defaultParams: { angleLimitDeg: 10, maxSegmentLen: 2 },
    paramsSchema: [
        { key: 'angleLimitDeg', label: 'Angle Limit (deg)', type: 'number', min: 0, max: 45, step: 1 },
        { key: 'maxSegmentLen', label: 'Max Segment Len', type: 'number', min: 0, max: 50, step: 0.5 }
    ],
    async apply(input, params, _ctx: FilterContext) {
        const paths = input as PathLike[];
        const angle = Math.max(0, params.angleLimitDeg || 0);
        const maxLen = Math.max(0, params.maxSegmentLen || 0);
        const out: PathLike[] = [];
        for (const p of paths) out.push(await subdividePathWasm(p, angle, maxLen));
        return out as any;
    }
};

export default SubdividePathsFilter;


