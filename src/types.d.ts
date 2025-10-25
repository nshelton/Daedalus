import { ElectronAPI } from './preload';

// Window electron API
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// ===== Raster Filter Chain Types =====

export type PathLike = [number, number][];

export type FilterIoKind = 'raster' | 'bitmap' | 'paths';

export type FilterInputMap = {
  raster: ImageData;
  bitmap: ImageData;
  paths: PathLike[];
};

export type FilterOutputMap = FilterInputMap;

export type ParamControlType = 'number' | 'boolean' | 'enum';

export interface FilterParamDef {
  key: string;
  label: string;
  type: ParamControlType;
  min?: number; max?: number; step?: number;
  options?: { label: string; value: string | number }[];
}

export interface FilterContext {
  rasterSize: { width: number; height: number };
  dpi?: number;
  pixelSizeMm?: number;
  onProgress?: (progress01: number) => void;
  abortSignal?: AbortSignal;
}

export interface FilterDefinition<P, In extends FilterIoKind, Out extends FilterIoKind> {
  id: string;
  label: string;
  // High-level entity this filter operates on (e.g., only bitmaps for image-based filters)
  entityKind: 'bitmap' | 'paths';
  inputKinds: In[];
  outputKind: Out;
  defaultParams: P;
  paramsSchema: FilterParamDef[];
  // Last measured execution duration in milliseconds for this filter definition
  lastExecutionMs?: number;
  apply(input: FilterInputMap[In], params: P, ctx: FilterContext): Promise<FilterOutputMap[Out]> | FilterOutputMap[Out];
}

export interface FilterInstance<In extends FilterIoKind = FilterIoKind, Out extends FilterIoKind = FilterIoKind> {
  instanceId: string;
  defId: string;
  enabled: boolean;
  visible: boolean;
  params: unknown;
  io: { input: In; output: Out };
}


