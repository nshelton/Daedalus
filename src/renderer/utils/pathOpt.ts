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


