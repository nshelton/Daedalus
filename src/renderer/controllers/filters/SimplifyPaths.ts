import type { FilterDefinition, FilterContext, PathLike } from '../../../types';
type Params = { angleLimitDeg: number; mergeDistance: number };

function distance(a: [number, number], b: [number, number]): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return Math.hypot(dx, dy);
}

function angleDeg(a: [number, number], b: [number, number], c: [number, number]): number {
    const v1x = a[0] - b[0];
    const v1y = a[1] - b[1];
    const v2x = c[0] - b[0];
    const v2y = c[1] - b[1];
    const n1 = Math.hypot(v1x, v1y);
    const n2 = Math.hypot(v2x, v2y);
    if (n1 < 1e-9 || n2 < 1e-9) return 180;
    const cos = (v1x * v2x + v1y * v2y) / (n1 * n2);
    return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
}

function removeConsecutiveDuplicates(points: PathLike): PathLike {
    if (points.length === 0) return points;
    const out: PathLike = [points[0]];
    for (let i = 1; i < points.length; i++) {
        const p = points[i];
        const q = out[out.length - 1];
        if (p[0] !== q[0] || p[1] !== q[1]) out.push(p);
    }
    return out;
}

function isClosed(points: PathLike): boolean {
    if (points.length < 2) return false;
    const a = points[0];
    const b = points[points.length - 1];
    return a[0] === b[0] && a[1] === b[1];
}

function simplifySinglePath(pointsIn: PathLike, angleLimitDeg: number): PathLike {
    let pts = removeConsecutiveDuplicates(pointsIn);
    const closed = isClosed(pts);
    if (closed && pts.length > 1) {
        // work without duplicate terminator, re-close later
        pts = pts.slice(0, -1);
    }
    if (pts.length < (closed ? 3 : 2)) {
        // Not enough points to simplify
        const out = closed && pts.length > 0 ? pts.concat([pts[0]]) : pts.slice();
        return out;
    }

    // Iteratively remove near-straight interior points
    const keepEndpoint = (idx: number): boolean => !closed && (idx === 0 || idx === pts.length - 1);
    let changed = true;
    while (changed) {
        changed = false;
        if (pts.length < (closed ? 3 : 3)) break;
        const toRemove: number[] = [];
        const count = pts.length;
        const start = closed ? 0 : 1;
        const end = closed ? count : count - 1;
        for (let i = start; i < end; i++) {
            if (keepEndpoint(i)) continue;
            const iPrev = closed ? (i - 1 + count) % count : i - 1;
            const iNext = closed ? (i + 1) % count : i + 1;
            if (iPrev < 0 || iNext >= count) continue;
            const a = pts[iPrev];
            const b = pts[i];
            const c = pts[iNext];
            const ang = angleDeg(a, b, c);
            const straightness = 180 - ang;
            if (straightness < angleLimitDeg) toRemove.push(i);
        }
        if (toRemove.length > 0) {
            // Remove from end to start to keep indices stable
            for (let k = toRemove.length - 1; k >= 0; k--) pts.splice(toRemove[k], 1);
            // Clean duplicates that may appear
            pts = removeConsecutiveDuplicates(pts);
            changed = true;
        }
    }

    if (closed) {
        if (pts.length >= 3) {
            // Re-close
            if (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1]) pts.push([pts[0][0], pts[0][1]]);
        } else {
            // Degenerate after simplification; return minimal closed ring if possible
            if (pts.length >= 1) pts = [pts[0], pts[0]];
        }
    }
    return pts;
}

function endpointsOf(path: PathLike): { start: [number, number]; end: [number, number] } {
    return { start: path[0], end: path[path.length - 1] };
}

function mergeTwoPaths(a: PathLike, b: PathLike, mode: 'AE_BS' | 'AE_BE' | 'AS_BS' | 'AS_BE'): PathLike {
    // Modes map:
    // AE_BS: A end to B start -> A + B
    // AE_BE: A end to B end   -> A + reverse(B)
    // AS_BS: A start to B start -> reverse(A) + B
    // AS_BE: A start to B end -> B + A
    let A = a, B = b;
    if (mode === 'AE_BE') B = b.slice().reverse();
    if (mode === 'AS_BS') A = a.slice().reverse();
    if (mode === 'AS_BE') { A = a; B = b; /* will assemble B + A */ }

    const ae = A[A.length - 1];
    const bs = (mode === 'AS_BE') ? B[B.length - 1] : B[0];
    const mid: [number, number] = [(ae[0] + bs[0]) / 2, (ae[1] + bs[1]) / 2];

    const A_no_last = A.slice(0, -1);
    const B_no_first = (mode === 'AS_BE') ? B.slice(0, -1) : B.slice(1);

    if (mode === 'AS_BE') return removeConsecutiveDuplicates(B_no_first.concat([mid], A_no_last));
    return removeConsecutiveDuplicates(A_no_last.concat([mid], B_no_first));
}

function isRing(path: PathLike): boolean {
    return isClosed(path);
}

function fuseEndpoints(pathsIn: PathLike[], mergeDistance: number): PathLike[] {
    const closed: PathLike[] = [];
    const open: PathLike[] = [];
    for (const p of pathsIn) {
        if (isRing(p)) closed.push(p);
        else open.push(p);
    }
    // Remove degenerate open paths
    let working: PathLike[] = open.filter(p => p.length >= 2);
    if (mergeDistance <= 0 || working.length <= 1) return closed.concat(working);

    // Iteratively fuse nearest endpoint pairs within threshold
    while (true) {
        let bestI = -1, bestJ = -1;
        let bestMode: 'AE_BS' | 'AE_BE' | 'AS_BS' | 'AS_BE' | null = null;
        let bestDist = Infinity;
        for (let i = 0; i < working.length; i++) {
            for (let j = i + 1; j < working.length; j++) {
                const A = working[i];
                const B = working[j];
                const { start: as, end: ae } = endpointsOf(A);
                const { start: bs, end: be } = endpointsOf(B);
                const dAE_BS = distance(ae, bs);
                if (dAE_BS < bestDist) { bestDist = dAE_BS; bestI = i; bestJ = j; bestMode = 'AE_BS'; }
                const dAE_BE = distance(ae, be);
                if (dAE_BE < bestDist) { bestDist = dAE_BE; bestI = i; bestJ = j; bestMode = 'AE_BE'; }
                const dAS_BS = distance(as, bs);
                if (dAS_BS < bestDist) { bestDist = dAS_BS; bestI = i; bestJ = j; bestMode = 'AS_BS'; }
                const dAS_BE = distance(as, be);
                if (dAS_BE < bestDist) { bestDist = dAS_BE; bestI = i; bestJ = j; bestMode = 'AS_BE'; }
            }
        }
        if (!(bestMode && bestDist < mergeDistance && bestI >= 0 && bestJ >= 0)) break;

        const merged = mergeTwoPaths(working[bestI], working[bestJ], bestMode);
        const next: PathLike[] = [];
        for (let k = 0; k < working.length; k++) if (k !== bestI && k !== bestJ) next.push(working[k]);
        next.push(merged);
        working = next;
        if (working.length <= 1) break;
    }

    return closed.concat(working);
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
        const merged: PathLike[] = fuseEndpoints(paths.map(p => simplifySinglePath(p, angleLimit)), Math.max(0, params.mergeDistance || 0));
        // After merging, run a light simplification pass again to clean joints
        const finalPaths = merged.map(p => simplifySinglePath(p, angleLimit)).filter(p => p.length >= 2);
        return finalPaths as any;
    }
};

export default SimplifyPathsFilter;


