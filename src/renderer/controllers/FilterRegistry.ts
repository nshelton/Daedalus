import type { FilterDefinition, FilterIoKind, FilterParamDef } from '../../types';

export class FilterRegistry {
    private defs: Map<string, FilterDefinition<any, any, any>> = new Map();

    register<P, In extends FilterIoKind, Out extends FilterIoKind>(def: FilterDefinition<P, In, Out>): void {
        if (!def || !def.id) throw new Error('Invalid filter definition');
        if (this.defs.has(def.id)) throw new Error(`Filter already registered: ${def.id}`);
        this.validateParamSchema(def.paramsSchema);
        this.defs.set(def.id, def as FilterDefinition<any, any, any>);
    }

    get(defId: string): FilterDefinition<any, any, any> | undefined {
        return this.defs.get(defId);
    }

    listByInput(kind: FilterIoKind): FilterDefinition<any, any, any>[] {
        return Array.from(this.defs.values()).filter(d => d.inputKinds.includes(kind as any));
    }

    validateParams(defId: string, params: unknown): boolean {
        const def = this.defs.get(defId);
        if (!def) return false;
        const schema = def.paramsSchema;
        if (!params || typeof params !== 'object') return false;
        for (const p of schema) {
            const value = (params as any)[p.key];
            if (value === undefined) return false;
            if (p.type === 'number') {
                if (typeof value !== 'number') return false;
                if (p.min !== undefined && value < p.min) return false;
                if (p.max !== undefined && value > p.max) return false;
            } else if (p.type === 'boolean') {
                if (typeof value !== 'boolean') return false;
            } else if (p.type === 'enum') {
                if (!p.options || !p.options.some(o => o.value === value)) return false;
            }
        }
        return true;
    }

    private validateParamSchema(schema: FilterParamDef[]): void {
        const seen = new Set<string>();
        for (const p of schema) {
            if (seen.has(p.key)) throw new Error(`Duplicate param key: ${p.key}`);
            seen.add(p.key);
        }
    }
}

export default FilterRegistry;


