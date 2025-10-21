import { Vertex, dotProductXY } from "../utils/geom.js";
import { vFinal_Vi_A_Dx, vInitial_VF_A_Dx } from "../utils/kinematics.js";

export interface PlannerSettings {
    speedPenDown: number; // in/s
    speedPenUp: number;   // in/s
    accelPenDown: number; // in/s^2
    accelPenUp: number;   // in/s^2
    cornering: number;    // unitless, matches reference scale
    timeSliceMs: number;  // ms
    maxStepRate: number;  // steps/ms per axis
    bounds: [[number, number], [number, number]]; // inches
    stepScale: number;    // steps per inch (native axis uses 2*scale internally)
    resolution: 1 | 2;    // 1=HR, 2=LR mapping follows project
    maxStepDistHr: number; // inches
    maxStepDistLr: number; // inches
    constSpeed: boolean;
}

export interface SegmentState {
    x: number;
    y: number;
    penUp: boolean;
}

export interface MoveCommand {
    kind: 'SM';
    s1: number; // motor 2 in ref, but we keep s1/s2 descriptive
    s2: number; // motor 1
    dtMs: number;
    seg: { x: number; y: number; penUp: boolean; dist: number };
}

export interface TrajectoryState {
    x: number;
    y: number;
    penUp: boolean;
}

export function planTrajectory(settings: PlannerSettings, vertexList: Vertex[], xyzPos?: SegmentState): { moves: MoveCommand[]; final: TrajectoryState } | null {
    if (vertexList.length < 2) return null;

    const start: SegmentState = xyzPos ? { ...xyzPos } : { x: vertexList[0].x, y: vertexList[0].y, penUp: false };
    const fPenUp = start.penUp;
    const speedLimit = fPenUp ? settings.speedPenUp : settings.speedPenDown;

    // Remove near-zero segments and compute unit vectors
    const minDist = settings.resolution === 1 ? settings.maxStepDistHr : settings.maxStepDistLr;
    const trimmed: Vertex[] = [];
    const segLens: number[] = []; // distance of each kept segment
    const vectors: [number, number][] = [];

    let last = vertexList[0];
    for (let i = 1; i < vertexList.length; i++) {
        const v = vertexList[i];
        const dx = v.x - last.x;
        const dy = v.y - last.y;
        const d = Math.hypot(dx, dy);
        if (d >= minDist) {
            trimmed.push({ x: v.x, y: v.y });
            segLens.push(d);
            vectors.push([dx / d, dy / d]);
            last = v;
        }
    }
    if (trimmed.length === 0) return null;
    if (trimmed.length === 1) {
        const res = computeSegment(settings, { x: trimmed[0].x, y: trimmed[0].y, vi: 0, vf: 0 }, start);
        if (!res) return null;
        return { moves: res.moves, final: { x: res.final.x, y: res.final.y, penUp: res.final.penUp } };
    }

    // Build arrival distances and forward velocity limits
    const trajDists: number[] = [0];
    for (let i = 0; i < segLens.length; i++) trajDists.push(segLens[i]);
    const accelRate = fPenUp ? settings.accelPenUp : settings.accelPenDown;
    const trajVels: number[] = [0];
    const delta = settings.cornering / 5000;

    for (let i = 1; i < trajDists.length - 0; i++) {
        if (i === trajDists.length - 1) break; // last vertex handled after loop
        const dcurrent = trajDists[i];
        const vPrevExit = trajVels[i - 1];

        let vcurrentMax: number;
        const tMax = speedLimit / accelRate;
        const accelDist = 0.5 * accelRate * tMax * tMax;
        if (dcurrent > accelDist) {
            vcurrentMax = speedLimit;
        } else {
            vcurrentMax = Math.min(vFinal_Vi_A_Dx(vPrevExit, accelRate, dcurrent), speedLimit);
        }

        // Cornering limit uses adjacent vectors at junction i
        const idxVec = i - 1; // vector leading into vertex i
        const idxVecOut = i;  // vector leaving vertex i
        if (idxVec >= 0 && idxVecOut < vectors.length) {
            const cosine = -dotProductXY(vectors[idxVec], vectors[idxVecOut]);
            const rootFactor = Math.sqrt((1 - cosine) / 2);
            const denom = 1 - rootFactor;
            const rfactor = denom > 0.0001 ? (delta * rootFactor) / denom : 100000;
            const vJunctionMax = Math.sqrt(accelRate * rfactor);
            vcurrentMax = Math.min(vcurrentMax, vJunctionMax);
        }
        trajVels.push(vcurrentMax);
    }
    trajVels.push(0); // final vertex speed

    // Backward pass: ensure deceleration feasibility
    for (let j = 1; j < trajDelsLen(trajDists); j++) {
        const i = trajDists.length - j;
        const vFinal = trajVels[i];
        let vInitial = trajVels[i - 1];
        const segLen = trajDists[i];
        if (vInitial > vFinal && segLen > 0) {
            const vInitMax = vInitial_VF_A_Dx_safe(vFinal, accelRate, segLen);
            if (vInitMax < vInitial) vInitial = vInitMax;
            trajVels[i - 1] = vInitial;
        }
    }

    // Emit segments
    let current = { ...start };
    const moves: MoveCommand[] = [];
    for (let i = 0; i < trimmed.length; i++) {
        const target = trimmed[i];
        const vi = trajVels[i];
        const vf = trajVels[i + 1];
        const segRes = computeSegment(settings, { x: target.x, y: target.y, vi, vf }, current);
        if (segRes) {
            current = segRes.final;
            moves.push(...segRes.moves);
        }
    }
    return { moves, final: { x: current.x, y: current.y, penUp: current.penUp } };
}

function trajDelsLen(d: number[]): number { return d.length; }
function vInitial_VF_A_Dx_safe(vf: number, accel: number, dx: number): number {
    return vInitial_VF_A_Dx(vf, -accel, dx);
}

function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

export function computeSegment(settings: PlannerSettings, data: { x: number; y: number; vi: number; vf: number }, xyz?: SegmentState): { moves: MoveCommand[]; final: SegmentState } | null {
    const start: SegmentState = xyz ? { ...xyz } : { x: 0, y: 0, penUp: false };
    const fPenUp = start.penUp;

    const xDest = data.x;
    const yDest = data.y;

    const dx = xDest - start.x;
    const dy = yDest - start.y;
    const segmentLenIn = Math.hypot(dx, dy);
    if (segmentLenIn <= 0) return null;

    const viIn = data.vi;
    const vfIn = data.vf;

    const speedLimit = fPenUp ? settings.speedPenUp : settings.speedPenDown;
    const accel = fPenUp ? settings.accelPenUp : settings.accelPenDown;

    const vi = clamp(viIn, 0, speedLimit);
    const vf = clamp(vfIn, 0, speedLimit);

    const timeSlice = settings.timeSliceMs / 1000.0; // seconds

    // CoreXY native axes distances in inches
    const motorDist1 = dx + dy;
    const motorDist2 = dx - dy;
    const motorSteps1 = Math.round(settings.stepScale * motorDist1);
    const motorSteps2 = Math.round(settings.stepScale * motorDist2);
    if (Math.abs(motorSteps1) < 1 && Math.abs(motorSteps2) < 1) return null;

    const motorDist1Rounded = motorSteps1 / (2.0 * settings.stepScale);
    const motorDist2Rounded = motorSteps2 / (2.0 * settings.stepScale);
    const dxRounded = motorDist1Rounded + motorDist2Rounded;
    const dyRounded = motorDist1Rounded - motorDist2Rounded;
    const segLen = Math.hypot(dxRounded, dyRounded);

    const tAccelMax = (speedLimit - vi) / accel;
    const tDecelMax = (speedLimit - vf) / accel;
    const accelDistMax = vi * tAccelMax + 0.5 * accel * tAccelMax * tAccelMax;
    const decelDistMax = vf * tDecelMax + 0.5 * accel * tDecelMax * tDecelMax;
    const maxVelTimeEstimate = segLen / speedLimit;

    const durationArray: number[] = [];
    const distArray: number[] = [];

    let timeElapsed = 0;
    let position = 0;
    let velocity = vi;

    const constantVelAllowed = settings.constSpeed && !fPenUp;

    if (!constantVelAllowed || fPenUp) {
        if ((segLen > (accelDistMax + decelDistMax + timeSlice * speedLimit)) && (maxVelTimeEstimate > 4 * timeSlice)) {
            // Trapezoid
            const speedMax = speedLimit;
            // Accel
            const intervalsUp = Math.floor(tAccelMax / timeSlice);
            if (intervalsUp > 0) {
                const timePer = tAccelMax / intervalsUp;
                const velStep = (speedMax - vi) / (intervalsUp + 1.0);
                for (let k = 0; k < intervalsUp; k++) {
                    velocity += velStep;
                    timeElapsed += timePer;
                    position += velocity * timePer;
                    durationArray.push(Math.round(timeElapsed * 1000.0));
                    distArray.push(position);
                }
            }
            // Coast
            const coastDist = segLen - (accelDistMax + decelDistMax);
            if (coastDist > (timeSlice * speedMax)) {
                velocity = speedMax;
                let ct = coastDist / velocity;
                const cruiseInterval = 20 * timeSlice;
                while (ct > cruiseInterval) {
                    ct -= cruiseInterval;
                    timeElapsed += cruiseInterval;
                    durationArray.push(Math.round(timeElapsed * 1000.0));
                    position += velocity * cruiseInterval;
                    distArray.push(position);
                }
                timeElapsed += ct;
                durationArray.push(Math.round(timeElapsed * 1000.0));
                position += velocity * ct;
                distArray.push(position);
            }
            // Decel
            const intervalsDown = Math.floor(tDecelMax / timeSlice);
            if (intervalsDown > 0) {
                const timePer = tDecelMax / intervalsDown;
                const velStep = (speedMax - vf) / (intervalsDown + 1.0);
                for (let k = 0; k < intervalsDown; k++) {
                    velocity -= velStep;
                    timeElapsed += timePer;
                    position += velocity * timePer;
                    durationArray.push(Math.round(timeElapsed * 1000.0));
                    distArray.push(position);
                }
            }
        } else {
            // Triangle / Linear / Constant fallback
            const accelLocal = (() => {
                if (segLen >= 0.9 * (accelDistMax + decelDistMax)) {
                    const denom = segLen || 1;
                    const scale = 0.9 * ((accelDistMax + decelDistMax) / denom);
                    return scale * accel;
                }
                return accel;
            })();

            let ta = accelLocal > 0 ? (Math.sqrt(2 * vi * vi + 2 * vf * vf + 4 * accelLocal * segLen) - 2 * vi) / (2 * accelLocal) : 0;
            const vmax = vi + accelLocal * ta;
            const intervalsUp = Math.floor(ta / timeSlice);
            if (intervalsUp === 0) {
                ta = 0;
            }
            const td = accelLocal > 0 ? ta - (vf - vi) / accelLocal : 0;
            const intervalsDown = Math.floor(td / timeSlice);

            if (intervalsUp + intervalsDown > 4) {
                if (intervalsUp > 0) {
                    const timePer = ta / intervalsUp;
                    const velStep = (vmax - vi) / (intervalsUp + 1.0);
                    for (let k = 0; k < intervalsUp; k++) {
                        velocity += velStep;
                        timeElapsed += timePer;
                        position += velocity * timePer;
                        durationArray.push(Math.round(timeElapsed * 1000.0));
                        distArray.push(position);
                    }
                }
                if (intervalsDown > 0) {
                    const timePer = td / intervalsDown;
                    const velStep = (vmax - vf) / (intervalsDown + 1.0);
                    for (let k = 0; k < intervalsDown; k++) {
                        velocity -= velStep;
                        timeElapsed += timePer;
                        position += velocity * timePer;
                        durationArray.push(Math.round(timeElapsed * 1000.0));
                        distArray.push(position);
                    }
                }
            } else {
                // Linear/constant fallback
                const localAccel = (vf * vf - vi * vi) / (2.0 * segLen);
                if (Math.abs(localAccel) < 1e-6) {
                    // constant
                    const v = vi > 0 ? vi : (speedLimit / 10);
                    const t = segLen / v;
                    timeElapsed = t;
                    durationArray.push(Math.round(timeElapsed * 1000.0));
                    distArray.push(segLen);
                    position = segLen;
                } else {
                    const tSeg = (vf - vi) / clamp(localAccel, -accel, accel);
                    const intervals = Math.floor(tSeg / timeSlice);
                    if (intervals > 1) {
                        const timePer = tSeg / intervals;
                        const velStep = (vf - vi) / (intervals + 1.0);
                        for (let k = 0; k < intervals; k++) {
                            velocity += velStep;
                            timeElapsed += timePer;
                            position += velocity * timePer;
                            durationArray.push(Math.round(timeElapsed * 1000.0));
                            distArray.push(position);
                        }
                    } else {
                        const v = Math.max(vi, vf, speedLimit / 10);
                        const t = segLen / v;
                        timeElapsed = t;
                        durationArray.push(Math.round(timeElapsed * 1000.0));
                        distArray.push(segLen);
                        position = segLen;
                    }
                }
            }
        }
    } else {
        // Constant velocity mode
        const v = Math.max(vi, vf, settings.speedPenDown / 10);
        const t = segLen / v;
        timeElapsed = t;
        durationArray.push(Math.round(timeElapsed * 1000.0));
        distArray.push(segLen);
        position = segLen;
    }

    // Scale trajectory to motor steps, and emit SM deltas
    const dest1: number[] = [];
    const dest2: number[] = [];
    for (let i = 0; i < distArray.length; i++) {
        const frac = position > 0 ? distArray[i] / position : 1;
        dest1.push(Math.round(frac * motorSteps1));
        dest2.push(Math.round(frac * motorSteps2));
    }

    let prev1 = 0;
    let prev2 = 0;
    let prevT = 0;
    const moves: MoveCommand[] = [];
    for (let i = 0; i < dest1.length; i++) {
        let sA_native = dest1[i] - prev1; // axis A = dx+dy
        let sB_native = dest2[i] - prev2; // native = dx-dy
        let dt = durationArray[i] - prevT;
        prevT = durationArray[i];
        if (dt < 1) dt = 1;

        // Too-slow filter
        // Lower the too-slow filter threshold to preserve micro-motions on tiny segments
        if (Math.abs(sA_native / dt) < 0.001) sA_native = 0;
        if (Math.abs(sB_native / dt) < 0.001) sB_native = 0;

        // Overspeed guard
        while ((Math.abs(sA_native / dt) >= settings.maxStepRate) || (Math.abs(sB_native / dt) >= settings.maxStepRate)) {
            dt += 1;
        }

        prev1 += sA_native;
        prev2 += sB_native;
        if (sA_native !== 0 || sB_native !== 0) {
            const xDelta = (sA_native / (settings.stepScale * 2.0)) + (sB_native / (settings.stepScale * 2.0));
            const yDelta = (sA_native / (settings.stepScale * 2.0)) - (sB_native / (settings.stepScale * 2.0));
            const moveDist = Math.hypot(xDelta, yDelta);
            const newX = start.x + xDelta;
            const newY = start.y + yDelta;
            // Map to AxidrawController axis mapping: axis1 = dx+dy = native A, axis2 = dy - dx = -(dx - dy) = -native B
            const axis1 = sA_native;
            const axis2 = -sB_native;
            moves.push({ kind: 'SM', s1: axis1, s2: axis2, dtMs: dt, seg: { x: newX, y: newY, penUp: fPenUp, dist: moveDist } });
        }
    }

    const finalX = start.x + dxRounded;
    const finalY = start.y + dyRounded;
    const finalState: SegmentState = { x: finalX, y: finalY, penUp: fPenUp };
    return { moves, final: finalState };
}


