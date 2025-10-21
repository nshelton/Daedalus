export function vFinal_Vi_A_Dx(vi: number, a: number, dx: number): number {
    return Math.sqrt(Math.max(0, vi * vi + 2 * a * dx));
}

export function vInitial_VF_A_Dx(vf: number, a: number, dx: number): number {
    return Math.sqrt(Math.max(0, vf * vf - 2 * a * dx));
}


