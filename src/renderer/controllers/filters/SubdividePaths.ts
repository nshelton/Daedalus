import type { FilterDefinition, FilterContext, PathLike } from '../../../types';
type Params = { angleLimitDeg: number; mergeDistance: number };

function subdivideSinglePath(pointsIn: PathLike, angleLimitDeg: number): PathLike {

    const n = pointsIn.length;
    const out = new Array<[number, number]>(n);
    for (let i = 0; i < n; i++) {
        out[i] = pointsIn[i];
    }
    return pointsIn;
}


export const SimplifyPathsFilter: FilterDefinition<Params, 'paths', 'paths'> = {
    id: 'simplifyPaths',
    label: 'Simplify Paths',
    entityKind: 'paths',
    inputKinds: ['paths'],
    outputKind: 'paths',
    defaultParams: { angleLimitDeg: 10, mergeDistance: 1 },
    paramsSchema: [
        { key: 'angleLimitDeg', label: 'Angle Limit (deg)', type: 'number', min: 0, max: 45, step: 1 },
        { key: 'mergeDistance', label: 'Merge Distance', type: 'number', min: 0, max: 10, step: 0.5 }
    ],
    async apply(input, params, _ctx: FilterContext) {
        const paths = input as PathLike[];
        const angleLimit = Math.max(0, params.angleLimitDeg || 0);
        const subdivided: PathLike[] = paths.map(p => subdivideSinglePath(p, angleLimit));
        return subdivided as any;
    }
};

export default SimplifyPathsFilter;


