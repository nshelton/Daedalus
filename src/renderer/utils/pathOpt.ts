import type { Vertex } from "./geom.js";
import { dist2 } from "./geom.js";

export type Path = [number, number][];

interface EndpointInfo {
    a: Vertex; // first point
    b: Vertex; // last point
}

export function optimizePathOrder(paths: Path[], start: Vertex): Path[] {
    if (paths.length <= 1) return paths;
    const endpoints: EndpointInfo[] = paths.map(p => ({ a: toV(p[0]), b: toV(p[p.length - 1]) }));
    const used = new Array(paths.length).fill(false);
    const result: Path[] = [];

    let cur = { x: start.x, y: start.y };
    for (let step = 0; step < paths.length; step++) {
        let best = -1;
        let bestFlip = false;
        let bestD2 = Infinity;
        for (let i = 0; i < paths.length; i++) {
            if (used[i]) continue;
            const e = endpoints[i];
            const dA = dist2(cur, e.a);
            if (dA < bestD2) { best = i; bestFlip = false; bestD2 = dA; }
            const dB = dist2(cur, e.b);
            if (dB < bestD2) { best = i; bestFlip = true; bestD2 = dB; }
        }
        used[best] = true;
        const chosen = bestFlip ? [...paths[best]].reverse() : paths[best];
        result.push(chosen);
        const last = chosen[chosen.length - 1];
        cur = toV(last);
    }
    return result;
}

function toV(p: [number, number]): Vertex { return { x: p[0], y: p[1] }; }

// Merge paths whose endpoints are within tolerance (in mm). Greedily chains paths, flipping as needed.
export function mergePathsWithinTolerance(paths: Path[], tolMm: number): Path[] {
    if (paths.length <= 1) return paths;
    const tol2 = tolMm * tolMm;
    const used = new Array(paths.length).fill(false);
    const endpoints = paths.map(p => ({ a: toV(p[0]), b: toV(p[p.length - 1]) }));
    const result: Path[] = [];

    for (let i = 0; i < paths.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        let chain = [...paths[i]];
        let extended = true;
        while (extended) {
            extended = false;
            const head = chain[0];
            const tail = chain[chain.length - 1];
            for (let j = 0; j < paths.length; j++) {
                if (used[j] || j === i) continue;
                const ep = endpoints[j];
                // tail ~ j.a → append j (drop duplicate start)
                if (dist2ArrV(tail, ep.a) <= tol2) {
                    chain = chain.concat(paths[j].slice(1));
                    used[j] = true;
                    extended = true;
                    break;
                }
                // tail ~ j.b → append reversed j (drop duplicate start)
                if (dist2ArrV(tail, ep.b) <= tol2) {
                    const pj = [...paths[j]].reverse();
                    chain = chain.concat(pj.slice(1));
                    used[j] = true;
                    extended = true;
                    break;
                }
                // j.b ~ head → prepend j (drop duplicate end)
                if (dist2VArr(ep.b, head) <= tol2) {
                    chain = paths[j].slice(0, paths[j].length - 1).concat(chain);
                    used[j] = true;
                    extended = true;
                    break;
                }
                // j.a ~ head → prepend reversed j (drop duplicate end)
                if (dist2VArr(ep.a, head) <= tol2) {
                    const pj = [...paths[j]].reverse();
                    chain = pj.slice(0, pj.length - 1).concat(chain);
                    used[j] = true;
                    extended = true;
                    break;
                }
            }
        }
        result.push(chain);
    }
    return result;
}

function dist2ArrV(a: [number, number], b: Vertex): number {
    const dx = a[0] - b.x;
    const dy = a[1] - b.y;
    return dx * dx + dy * dy;
}

function dist2VArr(a: Vertex, b: [number, number]): number {
    const dx = a.x - b[0];
    const dy = a.y - b[1];
    return dx * dx + dy * dy;
}


