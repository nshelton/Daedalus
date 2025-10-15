// DOM Elements
const penUpBtn = document.getElementById('pen-up-btn') as HTMLButtonElement;
const penDownBtn = document.getElementById('pen-down-btn') as HTMLButtonElement;
const plotBtn = document.getElementById('plot-btn') as HTMLButtonElement;
const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
const disengageBtn = document.getElementById('disengage-btn') as HTMLButtonElement;
const statusBtn = document.getElementById('status-btn') as HTMLButtonElement;
const debugAxesCheckbox = document.getElementById('debug-axes-checkbox') as HTMLInputElement;

const penUpSlider = document.getElementById('pen-up-slider') as HTMLInputElement;
const penDownSlider = document.getElementById('pen-down-slider') as HTMLInputElement;
const speedSlider = document.getElementById('speed-slider') as HTMLInputElement;

const penUpValue = document.getElementById('pen-up-value') as HTMLSpanElement;
const penDownValue = document.getElementById('pen-down-value') as HTMLSpanElement;
const speedValue = document.getElementById('speed-value') as HTMLSpanElement;

const statusIndicator = document.querySelector('.status-indicator') as HTMLElement;
const plotterControls = document.getElementById('plotter-controls') as HTMLElement;
const plotCanvas = document.getElementById('plot-canvas') as HTMLCanvasElement;
const plotPlaceholder = document.querySelector('.plot-placeholder') as HTMLElement;

const dataReceivedSpan = document.getElementById('data-received') as HTMLSpanElement;
const sampleRateSpan = document.getElementById('sample-rate') as HTMLSpanElement;
const lastValueSpan = document.getElementById('last-value') as HTMLSpanElement;

// Add new slider and value elements
const movingSpeedSlider = document.getElementById('moving-speed-slider') as HTMLInputElement;
const movingSpeedValue = document.getElementById('moving-speed-value') as HTMLSpanElement;

// A3 dimensions in mm
const A3_WIDTH_MM = 297;
const A3_HEIGHT_MM = 420;

// State
let isConnected: boolean = false;
let selectedPort: string | null = null;
let dataBuffer: number[] = [];
let totalBytesReceived: number = 0;
let lastSampleTime: number = Date.now();
let sampleCount: number = 0;

// Viewport state
let zoom = 1;
let panX = 0;
let panY = 0;
let isDraggingViewport = false;
let isDraggingEntity = false;
let isResizingEntity = false;
let dragStartX = 0;
let dragStartY = 0;
let selectedEntityId: string | null = null;
let resizeHandle: string | null = null;

// Context menu state
let contextMenu: HTMLDivElement | null = null;
let contextClickScreenX = 0;
let contextClickScreenY = 0;

// Vector font glyphs (stroke font). Each glyph is a sequence of commands:
// 'M', x, y (move) and 'L', x, y (line). Coordinates are in font units.
// Y axis is negative upward in glyph data; we flip to plotter coordinates when rendering.
const fontGlyphs: Record<string, (string | number)[]> = {
    " ": [],
    "!": ["M", 0, -12, "L", 0, 2, "M", 0, 7, "L", -1, 8, "L", 0, 9, "L", 1, 8, "L", 0, 7],
    "&": ["M", 0, -10, "L", -1, -11, "L", 0, -12, "L", 1, -11, "L", 1, -9, "L", 0, -7, "L", -1, -6],
    "(": ["M", 4, -16, "L", 2, -14, "L", 0, -11, "L", -2, -7, "L", -3, -2, "L", -3, 2, "L", -2, 7, "L", 0, 11, "L", 2, 14, "L", 4, 16],
    ")": ["M", -4, -16, "L", -2, -14, "L", 0, -11, "L", 2, -7, "L", 3, -2, "L", 3, 2, "L", 2, 7, "L", 0, 11, "L", -2, 14, "L", -4, 16],
    "*": ["M", 0, -12, "L", 0, 0, "M", -5, -9, "L", 5, -3, "M", 5, -9, "L", -5, -3],
    "+": ["M", 0, -9, "L", 0, 9, "M", -9, 0, "L", 9, 0],
    ",": ["M", 1, 8, "L", 0, 9, "L", -1, 8, "L", 0, 7, "L", 1, 8, "L", 1, 10, "L", 0, 12, "L", -1, 13],
    "-": ["M", -9, 0, "L", 9, 0],
    ".": ["M", 0, 7, "L", -1, 8, "L", 0, 9, "L", 1, 8, "L", 0, 7],
    "/": ["M", 9, -16, "L", -9, 16],
    "0": ["M", -1, -12, "L", -4, -11, "L", -6, -8, "L", -7, -3, "L", -7, 0, "L", -6, 5, "L", -4, 8, "L", -1, 9, "L", 1, 9, "L", 4, 8, "L", 6, 5, "L", 7, 0, "L", 7, -3, "L", 6, -8, "L", 4, -11, "L", 1, -12, "L", -1, -12],
    "1": ["M", -4, -8, "L", -2, -9, "L", 1, -12, "L", 1, 9],
    "2": ["M", -6, -7, "L", -6, -8, "L", -5, -10, "L", -4, -11, "L", -2, -12, "L", 2, -12, "L", 4, -11, "L", 5, -10, "L", 6, -8, "L", 6, -6, "L", 5, -4, "L", 3, -1, "L", -7, 9, "L", 7, 9],
    "3": ["M", -5, -12, "L", 6, -12, "L", 0, -4, "L", 3, -4, "L", 5, -3, "L", 6, -2, "L", 7, 1, "L", 7, 3, "L", 6, 6, "L", 4, 8, "L", 1, 9, "L", -2, 9, "L", -5, 8, "L", -6, 7, "L", -7, 5],
    "4": ["M", 3, -12, "L", -7, 2, "L", 8, 2, "M", 3, -12, "L", 3, 9],
    "5": ["M", 5, -12, "L", -5, -12, "L", -6, -3, "L", -5, -4, "L", -2, -5, "L", 1, -5, "L", 4, -4, "L", 6, -2, "L", 7, 1, "L", 7, 3, "L", 6, 6, "L", 4, 8, "L", 1, 9, "L", -2, 9, "L", -5, 8, "L", -6, 7, "L", -7, 5],
    "6": ["M", 6, -9, "L", 5, -11, "L", 2, -12, "L", 0, -12, "L", -3, -11, "L", -5, -8, "L", -6, -3, "L", -6, 2, "L", -5, 6, "L", -3, 8, "L", 0, 9, "L", 1, 9, "L", 4, 8, "L", 6, 6, "L", 7, 3, "L", 7, 2, "L", 6, -1, "L", 4, -3, "L", 1, -4, "L", 0, -4, "L", -3, -3, "L", -5, -1, "L", -6, 2],
    "7": ["M", 7, -12, "L", -3, 9, "M", -7, -12, "L", 7, -12],
    "8": ["M", -2, -12, "L", -5, -11, "L", -6, -9, "L", -6, -7, "L", -5, -5, "L", -3, -4, "L", 1, -3, "L", 4, -2, "L", 6, 0, "L", 7, 2, "L", 7, 5, "L", 6, 7, "L", 5, 8, "L", 2, 9, "L", -2, 9, "L", -5, 8, "L", -6, 7, "L", -7, 5, "L", -7, 2, "L", -6, 0, "L", -4, -2, "L", -1, -3, "L", 3, -4, "L", 5, -5, "L", 6, -7, "L", 6, -9, "L", 5, -11, "L", 2, -12, "L", -2, -12],
    "9": ["M", 6, -5, "L", 5, -2, "L", 3, 0, "L", 0, 1, "L", -1, 1, "L", -4, 0, "L", -6, -2, "L", -7, -5, "L", -7, -6, "L", -6, -9, "L", -4, -11, "L", -1, -12, "L", 0, -12, "L", 3, -11, "L", 5, -9, "L", 6, -5, "L", 6, 0, "L", 5, 5, "L", 3, 8, "L", 0, 9, "L", -2, 9, "L", -5, 8, "L", -6, 6],
    ":": ["M", 0, -5, "L", -1, -4, "L", 0, -3, "L", 1, -4, "L", 0, -5, "M", 0, 7, "L", -1, 8, "L", 0, 9, "L", 1, 8, "L", 0, 7],
    ";": ["M", 0, -5, "L", -1, -4, "L", 0, -3, "L", 1, -4, "L", 0, -5, "M", 1, 8, "L", 0, 9, "L", -1, 8, "L", 0, 7, "L", 1, 8, "L", 1, 10, "L", 0, 12, "L", -1, 13],
    "=": ["M", -9, -3, "L", 9, -3, "M", -9, 3, "L", 9, 3],
    "?": ["M", -6, -7, "L", -6, -8, "L", -5, -10, "L", -4, -11, "L", -2, -12, "L", 2, -12, "L", 4, -11, "L", 5, -10, "L", 6, -8, "L", 6, -6, "L", 5, -4, "L", 4, -3, "L", 0, -1, "L", 0, 2, "M", 0, 7, "L", -1, 8, "L", 0, 9, "L", 1, 8, "L", 0, 7],
    "@": ["M", 5, -4, "L", 4, -6, "L", 2, -7, "L", -1, -7, "L", -3, -6, "L", -4, -5, "L", -5, -2, "L", -5, 1, "L", -4, 3, "L", -2, 4, "L", 1, 4, "L", 3, 3, "L", 4, 1, "M", -1, -7, "L", -3, -5, "L", -4, -2, "L", -4, 1, "L", -3, 3, "L", -2, 4, "M", 5, -7, "L", 4, 1, "L", 4, 3, "L", 6, 4, "L", 8, 4, "L", 10, 2, "L", 11, -1, "L", 11, -3, "L", 10, -6, "L", 9, -8, "L", 7, -10, "L", 5, -11, "L", 2, -12, "L", -1, -12, "L", -4, -11, "L", -6, -10, "L", -8, -8, "L", -9, -6, "L", -10, -3, "L", -10, 0, "L", -9, 3, "L", -8, 5, "L", -6, 7, "L", -4, 8, "L", -1, 9, "L", 2, 9, "L", 5, 8, "L", 7, 7, "L", 8, 6, "M", 6, -7, "L", 5, 1, "L", 5, 3, "L", 6, 4],
    "A": ["M", 0, -12, "L", -8, 9, "M", 0, -12, "L", 8, 9, "M", -5, 2, "L", 5, 2],
    "B": ["M", -7, -12, "L", -7, 9, "M", -7, -12, "L", 2, -12, "L", 5, -11, "L", 6, -10, "L", 7, -8, "L", 7, -6, "L", 6, -4, "L", 5, -3, "L", 2, -2, "M", -7, -2, "L", 2, -2, "L", 5, -1, "L", 6, 0, "L", 7, 2, "L", 7, 5, "L", 6, 7, "L", 5, 8, "L", 2, 9, "L", -7, 9],
    "C": ["M", 8, -7, "L", 7, -9, "L", 5, -11, "L", 3, -12, "L", -1, -12, "L", -3, -11, "L", -5, -9, "L", -6, -7, "L", -7, -4, "L", -7, 1, "L", -6, 4, "L", -5, 6, "L", -3, 8, "L", -1, 9, "L", 3, 9, "L", 5, 8, "L", 7, 6, "L", 8, 4],
    "D": ["M", -7, -12, "L", -7, 9, "M", -7, -12, "L", 0, -12, "L", 3, -11, "L", 5, -9, "L", 6, -7, "L", 7, -4, "L", 7, 1, "L", 6, 4, "L", 5, 6, "L", 3, 8, "L", 0, 9, "L", -7, 9],
    "E": ["M", -6, -12, "L", -6, 9, "M", -6, -12, "L", 7, -12, "M", -6, -2, "L", 2, -2, "M", -6, 9, "L", 7, 9],
    "F": ["M", -6, -12, "L", -6, 9, "M", -6, -12, "L", 7, -12, "M", -6, -2, "L", 2, -2],
    "G": ["M", 8, -7, "L", 7, -9, "L", 5, -11, "L", 3, -12, "L", -1, -12, "L", -3, -11, "L", -5, -9, "L", -6, -7, "L", -7, -4, "L", -7, 1, "L", -6, 4, "L", -5, 6, "L", -3, 8, "L", -1, 9, "L", 3, 9, "L", 5, 8, "L", 7, 6, "L", 8, 4, "L", 8, 1, "M", 3, 1, "L", 8, 1],
    "H": ["M", -7, -12, "L", -7, 9, "M", 7, -12, "L", 7, 9, "M", -7, -2, "L", 7, -2],
    "I": ["M", 0, -12, "L", 0, 9],
    "J": ["M", 4, -12, "L", 4, 4, "L", 3, 7, "L", 2, 8, "L", 0, 9, "L", -2, 9, "L", -4, 8, "L", -5, 7, "L", -6, 4, "L", -6, 2],
    "K": ["M", -7, -12, "L", -7, 9, "M", 7, -12, "L", -7, 2, "M", -2, -3, "L", 7, 9],
    "L": ["M", -6, -12, "L", -6, 9, "M", -6, 9, "L", 6, 9],
    "M": ["M", -8, -12, "L", -8, 9, "M", -8, -12, "L", 0, 9, "M", 8, -12, "L", 0, 9, "M", 8, -12, "L", 8, 9],
    "N": ["M", -7, -12, "L", -7, 9, "M", -7, -12, "L", 7, 9, "M", 7, -12, "L", 7, 9],
    "O": ["M", -2, -12, "L", -4, -11, "L", -6, -9, "L", -7, -7, "L", -8, -4, "L", -8, 1, "L", -7, 4, "L", -6, 6, "L", -4, 8, "L", -2, 9, "L", 2, 9, "L", 4, 8, "L", 6, 6, "L", 7, 4, "L", 8, 1, "L", 8, -4, "L", 7, -7, "L", 6, -9, "L", 4, -11, "L", 2, -12, "L", -2, -12],
    "P": ["M", -7, -12, "L", -7, 9, "M", -7, -12, "L", 2, -12, "L", 5, -11, "L", 6, -10, "L", 7, -8, "L", 7, -5, "L", 6, -3, "L", 5, -2, "L", 2, -1, "L", -7, -1],
    "Q": ["M", -2, -12, "L", -4, -11, "L", -6, -9, "L", -7, -7, "L", -8, -4, "L", -8, 1, "L", -7, 4, "L", -6, 6, "L", -4, 8, "L", -2, 9, "L", 2, 9, "L", 4, 8, "L", 6, 6, "L", 7, 4, "L", 8, 1, "L", 8, -4, "L", 7, -7, "L", 6, -9, "L", 4, -11, "L", 2, -12, "L", -2, -12, "M", 1, 5, "L", 7, 11],
    "R": ["M", -7, -12, "L", -7, 9, "M", -7, -12, "L", 2, -12, "L", 5, -11, "L", 6, -10, "L", 7, -8, "L", 7, -6, "L", 6, -4, "L", 5, -3, "L", 2, -2, "L", -7, -2, "M", 0, -2, "L", 7, 9],
    "S": ["M", 7, -9, "L", 5, -11, "L", 2, -12, "L", -2, -12, "L", -5, -11, "L", -7, -9, "L", -7, -7, "L", -6, -5, "L", -5, -4, "L", -3, -3, "L", 3, -1, "L", 5, 0, "L", 6, 1, "L", 7, 3, "L", 7, 6, "L", 5, 8, "L", 2, 9, "L", -2, 9, "L", -5, 8, "L", -6, 7, "L", -7, 5],
    "T": ["M", 0, -12, "L", 0, 9, "M", -7, -12, "L", 7, -12],
    "U": ["M", -7, -12, "L", -7, 3, "L", -6, 6, "L", -4, 8, "L", -1, 9, "L", 1, 9, "L", 4, 8, "L", 6, 6, "L", 7, 3, "L", 7, -12],
    "V": ["M", -8, -12, "L", 0, 9, "M", 8, -12, "L", 0, 9],
    "W": ["M", -10, -12, "L", -5, 9, "M", 0, -12, "L", -5, 9, "M", 0, -12, "L", 5, 9, "M", 10, -12, "L", 5, 9],
    "X": ["M", -7, -12, "L", 7, 9, "M", 7, -12, "L", -7, 9],
    "Y": ["M", -8, -12, "L", 0, -2, "L", 0, 9, "M", 8, -12, "L", 0, -2],
    "Z": ["M", 7, -12, "L", -7, 9, "M", -7, -12, "L", 7, -12, "M", -7, 9, "L", 7, 9],
    "[": ["M", -3, -16, "L", -3, 16, "M", -2, -16, "L", -2, 16, "M", -3, -16, "L", 4, -16, "M", -3, 16, "L", 4, 16],
    "\\": ["M", -7, -12, "L", 7, 12],
    "]": ["M", 2, -16, "L", 2, 16, "M", 3, -16, "L", 3, 16, "M", -4, -16, "L", 3, -16, "M", -4, 16, "L", 3, 16],
    "^": ["M", -2, -6, "L", 0, -9, "L", 2, -6, "M", -5, -3, "L", 0, -8, "L", 5, -3, "M", 0, -8, "L", 0, 9],
    "_": ["M", -8, 11, "L", 8, 11],
    "`": ["M", 1, -12, "L", 0, -11, "L", -1, -9, "L", -1, -7, "L", 0, -6, "L", 1, -7, "L", 0, -8],
    "a": ["M", 6, -5, "L", 6, 9, "M", 6, -2, "L", 4, -4, "L", 2, -5, "L", -1, -5, "L", -3, -4, "L", -5, -2, "L", -6, 1, "L", -6, 3, "L", -5, 6, "L", -3, 8, "L", -1, 9, "L", 2, 9, "L", 4, 8, "L", 6, 6],
    "b": ["M", -6, -12, "L", -6, 9, "M", -6, -2, "L", -4, -4, "L", -2, -5, "L", 1, -5, "L", 3, -4, "L", 5, -2, "L", 6, 1, "L", 6, 3, "L", 5, 6, "L", 3, 8, "L", 1, 9, "L", -2, 9, "L", -4, 8, "L", -6, 6],
    "c": ["M", 6, -2, "L", 4, -4, "L", 2, -5, "L", -1, -5, "L", -3, -4, "L", -5, -2, "L", -6, 1, "L", -6, 3, "L", -5, 6, "L", -3, 8, "L", -1, 9, "L", 2, 9, "L", 4, 8, "L", 6, 6],
    "d": ["M", 6, -12, "L", 6, 9, "M", 6, -2, "L", 4, -4, "L", 2, -5, "L", -1, -5, "L", -3, -4, "L", -5, -2, "L", -6, 1, "L", -6, 3, "L", -5, 6, "L", -3, 8, "L", -1, 9, "L", 2, 9, "L", 4, 8, "L", 6, 6],
    "e": ["M", -6, 1, "L", 6, 1, "L", 6, -1, "L", 5, -3, "L", 4, -4, "L", 2, -5, "L", -1, -5, "L", -3, -4, "L", -5, -2, "L", -6, 1, "L", -6, 3, "L", -5, 6, "L", -3, 8, "L", -1, 9, "L", 2, 9, "L", 4, 8, "L", 6, 6],
    "f": ["M", 5, -12, "L", 3, -12, "L", 1, -11, "L", 0, -8, "L", 0, 9, "M", -3, -5, "L", 4, -5],
    "g": ["M", 6, -5, "L", 6, 11, "L", 5, 14, "L", 4, 15, "L", 2, 16, "L", -1, 16, "L", -3, 15, "M", 6, -2, "L", 4, -4, "L", 2, -5, "L", -1, -5, "L", -3, -4, "L", -5, -2, "L", -6, 1, "L", -6, 3, "L", -5, 6, "L", -3, 8, "L", -1, 9, "L", 2, 9, "L", 4, 8, "L", 6, 6],
    "h": ["M", -5, -12, "L", -5, 9, "M", -5, -1, "L", -2, -4, "L", 0, -5, "L", 3, -5, "L", 5, -4, "L", 6, -1, "L", 6, 9],
    "i": ["M", -1, -12, "L", 0, -11, "L", 1, -12, "L", 0, -13, "L", -1, -12, "M", 0, -5, "L", 0, 9],
    "j": ["M", 0, -12, "L", 1, -11, "L", 2, -12, "L", 1, -13, "L", 0, -12, "M", 1, -5, "L", 1, 12, "L", 0, 15, "L", -2, 16, "L", -4, 16],
    "k": ["M", -5, -12, "L", -5, 9, "M", 5, -5, "L", -5, 5, "M", -1, 1, "L", 6, 9],
    "l": ["M", 0, -12, "L", 0, 9],
    "m": ["M", -11, -5, "L", -11, 9, "M", -11, -1, "L", -8, -4, "L", -6, -5, "L", -3, -5, "L", -1, -4, "L", 0, -1, "L", 0, 9, "M", 0, -1, "L", 3, -4, "L", 5, -5, "L", 8, -5, "L", 10, -4, "L", 11, -1, "L", 11, 9],
    "n": ["M", -5, -5, "L", -5, 9, "M", -5, -1, "L", -2, -4, "L", 0, -5, "L", 3, -5, "L", 5, -4, "L", 6, -1, "L", 6, 9],
    "o": ["M", -1, -5, "L", -3, -4, "L", -5, -2, "L", -6, 1, "L", -6, 3, "L", -5, 6, "L", -3, 8, "L", -1, 9, "L", 2, 9, "L", 4, 8, "L", 6, 6, "L", 7, 3, "L", 7, 1, "L", 6, -2, "L", 4, -4, "L", 2, -5, "L", -1, -5],
    "p": ["M", -6, -5, "L", -6, 16, "M", -6, -2, "L", -4, -4, "L", -2, -5, "L", 1, -5, "L", 3, -4, "L", 5, -2, "L", 6, 1, "L", 6, 3, "L", 5, 6, "L", 3, 8, "L", 1, 9, "L", -2, 9, "L", -4, 8, "L", -6, 6],
    "q": ["M", 6, -5, "L", 6, 16, "M", 6, -2, "L", 4, -4, "L", 2, -5, "L", -1, -5, "L", -3, -4, "L", -5, -2, "L", -6, 1, "L", -6, 3, "L", -5, 6, "L", -3, 8, "L", -1, 9, "L", 2, 9, "L", 4, 8, "L", 6, 6],
    "r": ["M", -3, -5, "L", -3, 9, "M", -3, 1, "L", -2, -2, "L", 0, -4, "L", 2, -5, "L", 5, -5],
    "s": ["M", 6, -2, "L", 5, -4, "L", 2, -5, "L", -1, -5, "L", -4, -4, "L", -5, -2, "L", -4, 0, "L", -2, 1, "L", 3, 2, "L", 5, 3, "L", 6, 5, "L", 6, 6, "L", 5, 8, "L", 2, 9, "L", -1, 9, "L", -4, 8, "L", -5, 6],
    "t": ["M", 0, -12, "L", 0, 5, "L", 1, 8, "L", 3, 9, "L", 5, 9, "M", -3, -5, "L", 4, -5],
    "u": ["M", -5, -5, "L", -5, 5, "L", -4, 8, "L", -2, 9, "L", 1, 9, "L", 3, 8, "L", 6, 5, "M", 6, -5, "L", 6, 9],
    "v": ["M", -6, -5, "L", 0, 9, "M", 6, -5, "L", 0, 9],
    "w": ["M", -8, -5, "L", -4, 9, "M", 0, -5, "L", -4, 9, "M", 0, -5, "L", 4, 9, "M", 8, -5, "L", 4, 9],
    "x": ["M", -5, -5, "L", 6, 9, "M", 6, -5, "L", -5, 9],
    "y": ["M", -6, -5, "L", 0, 9, "M", 6, -5, "L", 0, 9, "L", -2, 13, "L", -4, 15, "L", -6, 16, "L", -7, 16],
    "z": ["M", 6, -5, "L", -5, 9, "M", -5, -5, "L", 6, -5, "M", -5, 9, "L", 6, 9],
    "{": ["M", 2, -16, "L", 0, -15, "L", 1, -14, "L", 2, -12, "L", 2, -10, "L", 1, -8, "L", 0, -7, "L", -1, -5, "L", -1, -3, "L", 1, -1, "M", 0, -15, "L", 1, -13, "L", 1, -11, "L", 0, -9, "L", -1, -8, "L", -2, -6, "L", -2, -4, "L", -1, -2, "L", 3, 0, "L", -1, 2, "L", -2, 4, "L", -2, 6, "L", -1, 8, "L", 0, 9, "L", 1, 11, "L", 1, 13, "L", 0, 15, "M", 1, 1, "L", -1, 3, "L", -1, 5, "L", 0, 7, "L", 1, 8, "L", 2, 10, "L", 2, 12, "L", 1, 14, "L", 0, 15, "L", -2, 16],
    "|": ["M", 0, -16, "L", 0, 16],
    "}": ["M", -2, -16, "L", 0, -15, "L", -1, -14, "L", -2, -12, "L", -2, -10, "L", -1, -8, "L", 0, -7, "L", 1, -5, "L", 1, -3, "L", -1, -1, "M", 0, -15, "L", -1, -13, "L", -1, -11, "L", 0, -9, "L", 1, -8, "L", 2, -6, "L", 2, -4, "L", 1, -2, "L", -3, 0, "L", 1, 2, "L", 2, 4, "L", 2, 6, "L", 1, 8, "L", 0, 9, "L", -1, 11, "L", -1, 13, "L", 0, 15, "M", -1, 1, "L", 1, 3, "L", 1, 5, "L", 0, 7, "L", -1, 8, "L", -2, 10, "L", -2, 12, "L", -1, 14, "L", 0, 15, "L", 2, 16],
    "~": ["M", -9, 3, "L", -9, 1, "L", -8, -2, "L", -6, -3, "L", -4, -3, "L", -2, -2, "L", 2, 1, "L", 4, 2, "L", 6, 2, "L", 8, 1, "L", 9, -1, "M", -9, 1, "L", -8, -1, "L", -6, -2, "L", -4, -2, "L", -2, -1, "L", 2, 2, "L", 4, 3, "L", 6, 3, "L", 8, 2, "L", 9, -1, "L", 9, -3]
};

function glyphToPaths(cmds: (string | number)[], offsetX: number, offsetY: number, scale: number): [number, number][][] {
    const paths: [number, number][][] = [];
    let i = 0;
    let currentPath: [number, number][] | null = null;
    while (i < cmds.length) {
        const op = cmds[i++] as string;
        const x = cmds[i++] as number;
        const y = cmds[i++] as number;
        const px = offsetX + x * scale;
        const py = offsetY + (-y) * scale; // flip Y for plotter coords
        if (op === 'M') {
            if (currentPath && currentPath.length > 0) {
                paths.push(currentPath);
            }
            currentPath = [[px, py]];
        } else if (op === 'L') {
            if (!currentPath) {
                currentPath = [[px, py]];
            } else {
                currentPath.push([px, py]);
            }
        }
    }
    if (currentPath && currentPath.length > 0) {
        paths.push(currentPath);
    }
    return paths;
}

function measureGlyphWidthUnits(cmds: (string | number)[]): number {
    if (!cmds || cmds.length === 0) return 10;
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < cmds.length;) {
        /* op is not needed for width, just consume */
        i++;
        const x = cmds[i++] as number;
        /* y consumed but unused for width */
        i++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
    }
    const width = maxX - minX;
    return isFinite(width) && width > 0 ? width : 10;
}

function textToPaths(text: string, originX: number, originY: number, heightMm: number = 10, letterSpacingUnits: number = 2): [number, number][][] {
    const paths: [number, number][][] = [];
    const unitsTall = 32; // approx -16..+16
    const scale = heightMm / unitsTall;
    let cursorUnitsX = 0;
    for (const ch of text) {
        const cmds = fontGlyphs[ch];
        const widthUnits = cmds ? measureGlyphWidthUnits(cmds) : 10;
        if (cmds && cmds.length > 0) {
            const glyphPaths = glyphToPaths(cmds, originX + cursorUnitsX * scale, originY, scale);
            glyphPaths.forEach(p => paths.push(p));
        }
        cursorUnitsX += widthUnits + letterSpacingUnits;
    }
    return paths;
}

// Plot entities
interface PlotEntity {
    id: string;
    paths: [number, number][][]; // Array of paths, each path is array of [x, y] points
}

let entities: PlotEntity[] = [];

// Helper to create a simple Pikachu character for testing
function createPikachuPath(cx: number, cy: number, size: number): [number, number][][] {
    const paths: [number, number][][] = [];
    const scale = size / 100; // Scale factor

    // Head (circle with slight oval shape)
    const headPath: [number, number][] = [];
    for (let i = 0; i <= 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        const x = cx + Math.cos(angle) * 25 * scale;
        const y = cy + Math.sin(angle) * 22 * scale; // Slightly oval
        headPath.push([x, y]);
    }
    paths.push(headPath);

    // Left ear
    const leftEarPath: [number, number][] = [];
    leftEarPath.push([cx - 20 * scale, cy - 15 * scale]);
    leftEarPath.push([cx - 25 * scale, cy - 25 * scale]);
    leftEarPath.push([cx - 15 * scale, cy - 20 * scale]);
    leftEarPath.push([cx - 20 * scale, cy - 15 * scale]);
    paths.push(leftEarPath);

    // Right ear
    const rightEarPath: [number, number][] = [];
    rightEarPath.push([cx + 20 * scale, cy - 15 * scale]);
    rightEarPath.push([cx + 25 * scale, cy - 25 * scale]);
    rightEarPath.push([cx + 15 * scale, cy - 20 * scale]);
    rightEarPath.push([cx + 20 * scale, cy - 15 * scale]);
    paths.push(rightEarPath);

    // Left eye
    const leftEyePath: [number, number][] = [];
    for (let i = 0; i <= 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const x = cx - 8 * scale + Math.cos(angle) * 3 * scale;
        const y = cy - 5 * scale + Math.sin(angle) * 3 * scale;
        leftEyePath.push([x, y]);
    }
    paths.push(leftEyePath);

    // Right eye
    const rightEyePath: [number, number][] = [];
    for (let i = 0; i <= 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const x = cx + 8 * scale + Math.cos(angle) * 3 * scale;
        const y = cy - 5 * scale + Math.sin(angle) * 3 * scale;
        rightEyePath.push([x, y]);
    }
    paths.push(rightEyePath);

    // Nose (triangle)
    const nosePath: [number, number][] = [];
    nosePath.push([cx, cy + 2 * scale]);
    nosePath.push([cx - 2 * scale, cy + 5 * scale]);
    nosePath.push([cx + 2 * scale, cy + 5 * scale]);
    nosePath.push([cx, cy + 2 * scale]);
    paths.push(nosePath);

    // Mouth (smile)
    const mouthPath: [number, number][] = [];
    for (let i = 0; i <= 16; i++) {
        const angle = Math.PI + (i / 16) * Math.PI; // Half circle
        const x = cx + Math.cos(angle) * 8 * scale;
        const y = cy + 8 * scale + Math.sin(angle) * 4 * scale;
        mouthPath.push([x, y]);
    }
    paths.push(mouthPath);

    // Body (oval)
    const bodyPath: [number, number][] = [];
    for (let i = 0; i <= 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        const x = cx + Math.cos(angle) * 18 * scale;
        const y = cy + 25 * scale + Math.sin(angle) * 15 * scale;
        bodyPath.push([x, y]);
    }
    paths.push(bodyPath);

    // Left arm
    const leftArmPath: [number, number][] = [];
    leftArmPath.push([cx - 18 * scale, cy + 20 * scale]);
    leftArmPath.push([cx - 30 * scale, cy + 35 * scale]);
    leftArmPath.push([cx - 25 * scale, cy + 40 * scale]);
    leftArmPath.push([cx - 15 * scale, cy + 30 * scale]);
    paths.push(leftArmPath);

    // Right arm
    const rightArmPath: [number, number][] = [];
    rightArmPath.push([cx + 18 * scale, cy + 20 * scale]);
    rightArmPath.push([cx + 30 * scale, cy + 35 * scale]);
    rightArmPath.push([cx + 25 * scale, cy + 40 * scale]);
    rightArmPath.push([cx + 15 * scale, cy + 30 * scale]);
    paths.push(rightArmPath);

    // Left leg
    const leftLegPath: [number, number][] = [];
    leftLegPath.push([cx - 8 * scale, cy + 40 * scale]);
    leftLegPath.push([cx - 12 * scale, cy + 55 * scale]);
    leftLegPath.push([cx - 5 * scale, cy + 60 * scale]);
    leftLegPath.push([cx - 2 * scale, cy + 50 * scale]);
    paths.push(leftLegPath);

    // Right leg
    const rightLegPath: [number, number][] = [];
    rightLegPath.push([cx + 8 * scale, cy + 40 * scale]);
    rightLegPath.push([cx + 12 * scale, cy + 55 * scale]);
    rightLegPath.push([cx + 5 * scale, cy + 60 * scale]);
    rightLegPath.push([cx + 2 * scale, cy + 50 * scale]);
    paths.push(rightLegPath);

    // Tail (zigzag)
    const tailPath: [number, number][] = [];
    tailPath.push([cx + 18 * scale, cy + 25 * scale]);
    tailPath.push([cx + 35 * scale, cy + 15 * scale]);
    tailPath.push([cx + 30 * scale, cy + 5 * scale]);
    tailPath.push([cx + 45 * scale, cy - 5 * scale]);
    tailPath.push([cx + 40 * scale, cy - 15 * scale]);
    paths.push(tailPath);

    return paths;
}

// Helper to create a circle as paths
function createCirclePaths(cx: number, cy: number, radius: number): [number, number][][] {
    const path: [number, number][] = [];
    const segments = 64;

    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        path.push([x, y]);
    }

    return [path]; // Return as array of paths (single path for a circle)
}

function createSquarePath(cx: number, cy: number, size: number): [number, number][][] {
    const path: [number, number][] = [];
    path.push([cx, cy]);
    path.push([cx + size, cy]);
    path.push([cx + size, cy + size]);
    path.push([cx, cy + size]);
    path.push([cx, cy]);
    return [path];
}

// Helper to create axes with arrowheads
function createAxesPaths(cx: number, cy: number, length: number = 100, arrow: number = 10): [number, number][][] {
    const paths: [number, number][][] = [];

    // X axis line
    const xEnd: [number, number] = [cx + length, cy];
    paths.push([[cx, cy], xEnd]);
    // X axis arrowheads
    paths.push([xEnd, [xEnd[0] - arrow, xEnd[1] + arrow * 0.3]]);
    paths.push([xEnd, [xEnd[0] - arrow, xEnd[1] - arrow * 0.3]]);

    // Y axis line
    const yEnd: [number, number] = [cx, cy + length];
    paths.push([[cx, cy], yEnd]);
    // Y axis arrowheads
    paths.push([yEnd, [yEnd[0] + arrow * 0.3, yEnd[1] - arrow]]);
    paths.push([yEnd, [yEnd[0] - arrow * 0.3, yEnd[1] - arrow]]);

    return paths;
}

// Initialize the application
async function init(): Promise<void> {
    setupEventListeners();
    setupCanvas();
    updateConnectionStatus(false, 'Disconnected');
    console.log('Plotter interface initialized');
}

// Cleanup on page unload/reload
window.addEventListener('beforeunload', async () => {
    if (isConnected) {
        console.log('Cleaning up serial connection before unload...');
        try {
            await window.electronAPI.disconnectSerial();
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
});

// Setup event listeners
function setupEventListeners(): void {
    // Status button (acts as connect/disconnect)
    statusBtn.addEventListener('click', handleConnect);

    // Plotter control buttons
    penUpBtn.addEventListener('click', handlePenUp);
    penDownBtn.addEventListener('click', handlePenDown);
    plotBtn.addEventListener('click', handlePlot);
    stopBtn.addEventListener('click', handleStop);
    disengageBtn.addEventListener('click', handleDisengage);

    // Slider listeners
    penUpSlider.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        penUpValue.textContent = value;
    });

    penUpSlider.addEventListener('change', async (e) => {
        const value = parseInt((e.target as HTMLInputElement).value);
        await handleSetPenUpPosition(value);
    });

    penDownSlider.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        penDownValue.textContent = value;
    });

    penDownSlider.addEventListener('change', async (e) => {
        const value = parseInt((e.target as HTMLInputElement).value);
        await handleSetPenDownPosition(value);
    });

    speedSlider.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        speedValue.textContent = value;
    });

    speedSlider.addEventListener('change', async (e) => {
        const value = parseInt((e.target as HTMLInputElement).value);
        await handleSetSpeed(value);
    });

    // Add event listener for moving speed slider
    movingSpeedSlider.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        movingSpeedValue.textContent = value;
    });

    // Add handler for setting moving speed
    async function handleSetMovingSpeed(value: number): Promise<void> {
        try {
            await window.electronAPI.setMovingSpeed(value);
            console.log('Moving speed set to:', value);
        } catch (error) {
            console.error('Failed to set moving speed:', error);
        }
    }

    // Add event listener for moving speed slider change
    movingSpeedSlider.addEventListener('change', async (e) => {
        const value = parseInt((e.target as HTMLInputElement).value);
        await handleSetMovingSpeed(value);
    });

    // Canvas interactions
    plotCanvas.addEventListener('wheel', handleWheel, { passive: false });
    plotCanvas.addEventListener('mousedown', handleMouseDown);
    plotCanvas.addEventListener('mousemove', handleMouseMove);
    plotCanvas.addEventListener('mouseup', handleMouseUp);
    plotCanvas.addEventListener('mouseleave', handleMouseUp);
    plotCanvas.addEventListener('dblclick', handleDoubleClick);
    plotCanvas.addEventListener('contextmenu', handleContextMenu);

    // Hide context menu on any left-click or scroll elsewhere
    document.addEventListener('click', () => hideContextMenu());
    plotCanvas.addEventListener('wheel', () => hideContextMenu());

    // Listen for serial data
    window.electronAPI.onSerialData(handleSerialData);
}

// Plotter Control Functions
async function handlePenUp(): Promise<void> {
    try {
        penUpBtn.disabled = true;
        const result = await window.electronAPI.plotterPenUp();
        if (!result.success) {
            console.error('Pen up failed:', result.error);
        }
    } catch (error) {
        console.error('Error sending pen up:', error);
    } finally {
        penUpBtn.disabled = false;
    }
}

async function handlePenDown(): Promise<void> {
    try {
        penDownBtn.disabled = true;
        const result = await window.electronAPI.plotterPenDown();
        if (!result.success) {
            console.error('Pen down failed:', result.error);
        }
    } catch (error) {
        console.error('Error sending pen down:', error);
    } finally {
        penDownBtn.disabled = false;
    }
}

async function handlePlot(): Promise<void> {
    try {
        plotBtn.disabled = true;
        plotBtn.textContent = 'Plotting...';

        // Convert entities to paths
        let paths = entitiesToPaths(entities);

        // Add debug axes if enabled
        if (debugAxesCheckbox.checked) {
            console.log('Adding debug axes (10cm X and Y)');
            const xAxisPath: [number, number][] = [[0, 0], [100, 0]]; // 10cm along X
            const yAxisPath: [number, number][] = [[0, 0], [0, 100]]; // 10cm along Y

            // Prepend axes to the beginning
            paths = [xAxisPath, yAxisPath, ...paths];
        }

        if (paths.length === 0) {
            console.warn('No entities to plot');
            alert('No entities to plot. Double-click on the canvas to add circles.');
            return;
        }

        console.log(`Plotting ${paths.length} paths from ${entities.length} entities`);

        // Send paths to plotter
        const result = await window.electronAPI.plotterPlotPath(paths, true);

        if (result.success) {
            console.log('Paths queued successfully');

            // Start queue consumption
            await window.electronAPI.plotterStartQueue();
            console.log('Queue consumption started');
        } else {
            console.error('Plot path failed:', result.error);
            alert('Failed to plot: ' + result.error);
        }
    } catch (error) {
        console.error('Error plotting:', error);
        alert('Error plotting: ' + error);
    } finally {
        plotBtn.disabled = false;
        plotBtn.textContent = 'PLOT';
    }
}

async function handleStop(): Promise<void> {
    try {
        stopBtn.disabled = true;
        stopBtn.textContent = 'Stopping...';

        console.log('Stopping plot...');

        // Stop queue consumption
        await window.electronAPI.plotterStopQueue();

        // Reset the plotter state
        await window.electronAPI.plotterReset();

        // Pen up
        await window.electronAPI.plotterPenUp();

        console.log('Plot stopped and reset');
    } catch (error) {
        console.error('Error stopping plot:', error);
        alert('Error stopping: ' + error);
    } finally {
        stopBtn.disabled = false;
        stopBtn.textContent = 'STOP';
    }
}

async function handleDisengage(): Promise<void> {
    try {
        disengageBtn.disabled = true;
        const result = await window.electronAPI.plotterDisengage();
        if (!result.success) {
            console.error('Disengage failed:', result.error);
        }
    } catch (error) {
        console.error('Error disengaging motors:', error);
    } finally {
        disengageBtn.disabled = false;
    }
}

async function handleSetPenUpPosition(value: number): Promise<void> {
    try {
        const result = await window.electronAPI.plotterSetPenUpValue(value);
        if (!result.success) {
            console.error('Set pen up position failed:', result.error);
        }
    } catch (error) {
        console.error('Error setting pen up position:', error);
    }
}

async function handleSetPenDownPosition(value: number): Promise<void> {
    try {
        const result = await window.electronAPI.plotterSetPenDownValue(value);
        if (!result.success) {
            console.error('Set pen down position failed:', result.error);
        }
    } catch (error) {
        console.error('Error setting pen down position:', error);
    }
}

async function handleSetSpeed(value: number): Promise<void> {
    try {
        const result = await window.electronAPI.plotterSetSpeed(value);
        if (!result.success) {
            console.error('Set speed failed:', result.error);
        }
    } catch (error) {
        console.error('Error setting speed:', error);
    }
}

// Manual connect/disconnect handler
async function handleConnect(): Promise<void> {
    if (isConnected) {
        // Disconnect
        try {
            statusBtn.disabled = true;
            updateConnectionStatus(false, 'Disconnecting...');

            const result = await window.electronAPI.disconnectSerial();

            if (result.success) {
                isConnected = false;
                selectedPort = null;
                updateConnectionStatus(false, 'Disconnected');
                console.log('Disconnected from plotter');
            } else {
                console.error('Disconnect failed:', result.error);
                updateConnectionStatus(isConnected, selectedPort || 'Error');
            }
        } catch (error) {
            console.error('Disconnect error:', error);
            updateConnectionStatus(isConnected, selectedPort || 'Error');
        } finally {
            statusBtn.disabled = false;
        }
    } else {
        // Connect
        try {
            statusBtn.disabled = true;
            updateConnectionStatus(false, 'Searching...');

            const plotterPort = await window.electronAPI.findPlotterPort();

            if (plotterPort) {
                console.log('Found plotter port:', plotterPort.path);
                updateConnectionStatus(false, 'Connecting...');

                const result = await window.electronAPI.connectSerial(plotterPort.path, 115200);

                if (result.success) {
                    isConnected = true;
                    selectedPort = plotterPort.path;
                    updateConnectionStatus(true, plotterPort.path);
                    console.log('Connected to plotter:', plotterPort.path);

                    // Initialize plotter with servo settings
                    await initializePlotter();
                } else {
                    console.error('Connection failed:', result.error);
                    updateConnectionStatus(false, 'Failed');
                }
            } else {
                console.log('No plotter port found');
                updateConnectionStatus(false, 'Not Found');
            }
        } catch (error) {
            console.error('Connect failed:', error);
            updateConnectionStatus(false, 'Error');
        } finally {
            statusBtn.disabled = false;
        }
    }
}

// Initialize plotter with current slider values
async function initializePlotter(): Promise<void> {
    try {
        // Get current plotter state
        const state = await window.electronAPI.plotterGetState();

        // Update sliders to match plotter state
        penUpSlider.value = state.penUpPosition.toString();
        penUpValue.textContent = state.penUpPosition.toString();

        penDownSlider.value = state.penDownPosition.toString();
        penDownValue.textContent = state.penDownPosition.toString();

        speedSlider.value = state.speed.toString();
        speedValue.textContent = state.speed.toString();

        // Send initialization commands to plotter
        const result = await window.electronAPI.plotterInitialize();

        if (result.success) {
            console.log('Plotter initialized successfully');

            // Reset position to (0,0) on connection
            console.log('Setting plotter position to origin (0,0)...');
            await window.electronAPI.plotterSetOrigin();

            // Query actual position from EBB to sync with hardware
            const positionResult = await window.electronAPI.plotterGetPosition();
            if (positionResult.success && positionResult.position) {
                console.log(`Plotter actual position: [${positionResult.position[0].toFixed(2)}, ${positionResult.position[1].toFixed(2)}]mm`);
            } else {
                console.log('Could not query plotter position, assuming (0,0)');
            }
        } else {
            console.error('Plotter initialization failed:', result.error);
        }
    } catch (error) {
        console.error('Error initializing plotter:', error);
    }
}

// Update connection status display
function updateConnectionStatus(connected: boolean, text?: string): void {
    if (connected) {
        statusIndicator.classList.remove('disconnected');
        statusIndicator.classList.add('connected');
        statusBtn.textContent = text || 'Connected';
        plotterControls.style.display = 'block';
    } else {
        statusIndicator.classList.remove('connected');
        statusIndicator.classList.add('disconnected');
        statusBtn.textContent = text || 'Disconnected';
        plotterControls.style.display = 'none';
    }
}

// Handle incoming serial data
function handleSerialData(data: any): void {
    totalBytesReceived += data.length;
    dataReceivedSpan.textContent = `${totalBytesReceived} bytes`;

    // Update sample rate
    sampleCount++;
    const now = Date.now();
    const elapsed = (now - lastSampleTime) / 1000;
    if (elapsed >= 1.0) {
        const rate = sampleCount / elapsed;
        sampleRateSpan.textContent = `${rate.toFixed(1)} Hz`;
        sampleCount = 0;
        lastSampleTime = now;
    }

    // Parse and store data (placeholder for actual plotting logic)
    try {
        const value = parseFloat(data.toString().trim());
        if (!isNaN(value)) {
            lastValueSpan.textContent = value.toFixed(2);
            dataBuffer.push(value);

            // Limit buffer size
            const maxPoints = 1000;
            if (dataBuffer.length > maxPoints) {
                dataBuffer.shift();
            }
        }
    } catch (error) {
        console.error('Error parsing data:', error);
    }
}

// Clear data buffers
function clearData(): void {
    dataBuffer = [];
    totalBytesReceived = 0;
    sampleCount = 0;
    lastSampleTime = Date.now();

    dataReceivedSpan.textContent = '0 bytes';
    sampleRateSpan.textContent = '0 Hz';
    lastValueSpan.textContent = '—';

    console.log('Data cleared');
}

// Canvas setup and rendering
function setupCanvas(): void {
    const container = plotCanvas.parentElement!;
    plotCanvas.width = container.clientWidth;
    plotCanvas.height = container.clientHeight;

    // Hide placeholder, show canvas
    plotPlaceholder.style.display = 'none';
    plotCanvas.style.display = 'block';

    // Position viewport so (0,0) is bottom-left of A3 paper
    // Center the paper on screen with some padding
    const padding = 50;
    panX = padding;
    panY = plotCanvas.height - padding;
    zoom = Math.min(
        (plotCanvas.width - padding * 2) / A3_WIDTH_MM,
        (plotCanvas.height - padding * 2) / A3_HEIGHT_MM
    );

    // Remove the test circle - the 1cm grid is already drawn in drawA3Paper()
    // entities.push({
    //     id: 'circle1',
    //     paths: createCirclePaths(60, 60, 40) // Circle at (60, 60) from bottom-left with radius 40
    // });

    // Start render loop
    requestAnimationFrame(render);

    // Handle window resize
    window.addEventListener('resize', () => {
        plotCanvas.width = container.clientWidth;
        plotCanvas.height = container.clientHeight;
        render();
    });
}

function render(): void {
    const ctx = plotCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, plotCanvas.width, plotCanvas.height);

    // Fill background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, plotCanvas.width, plotCanvas.height);

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Draw A3 paper
    drawA3Paper(ctx);

    // Draw entities
    entities.forEach(entity => {
        drawEntity(ctx, entity, entity.id === selectedEntityId);
    });

    ctx.restore();

    requestAnimationFrame(render);
}

function drawA3Paper(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2 / zoom;

    // Paper origin at (0, 0) - bottom-left corner in plotter coordinates
    // Canvas Y increases downward, so we need to flip for plotter coords
    ctx.save();
    ctx.scale(1, -1); // Flip Y axis so plotter (0,0) is bottom-left

    const x = 0;
    const y = 0;

    ctx.fillRect(x, y, A3_WIDTH_MM, A3_HEIGHT_MM);
    ctx.strokeRect(x, y, A3_WIDTH_MM, A3_HEIGHT_MM);

    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5 / zoom;

    const gridSize = 10; // 10mm grid
    for (let i = x; i <= x + A3_WIDTH_MM; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(i, y);
        ctx.lineTo(i, y + A3_HEIGHT_MM);
        ctx.stroke();
    }

    for (let i = y; i <= y + A3_HEIGHT_MM; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, i);
        ctx.lineTo(x + A3_WIDTH_MM, i);
        ctx.stroke();
    }

    // Draw origin marker
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(20, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 20);
    ctx.stroke();

    ctx.restore();
}

function drawEntity(ctx: CanvasRenderingContext2D, entity: PlotEntity, isSelected: boolean): void {
    ctx.save();

    // Flip Y axis to match plotter coordinates (0,0 at bottom-left)
    ctx.scale(1, -1);

    // Draw all paths in the entity
    entity.paths.forEach(path => {
        if (path.length === 0) return;

        ctx.beginPath();
        ctx.moveTo(path[0][0], path[0][1]);

        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i][0], path[i][1]);
        }

        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.fill();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
    });

    if (isSelected) {
        // Draw bounding box
        const bounds = getEntityBounds(entity);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2 / zoom;
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

        // Draw resize handles
        const handleSize = 8 / zoom;
        ctx.fillStyle = '#ef4444';
        const handles = getResizeHandles(bounds);
        handles.forEach(h => {
            ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
        });
    }

    ctx.restore();
}

// Calculate bounding box for entity
function getEntityBounds(entity: PlotEntity): { x: number; y: number; width: number; height: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    entity.paths.forEach(path => {
        path.forEach(([x, y]) => {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });
    });

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

function getResizeHandles(bounds: { x: number; y: number; width: number; height: number }): { id: string; x: number; y: number }[] {
    return [
        { id: 'nw', x: bounds.x, y: bounds.y },
        { id: 'ne', x: bounds.x + bounds.width, y: bounds.y },
        { id: 'sw', x: bounds.x, y: bounds.y + bounds.height },
        { id: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    ];
}

// Mouse interaction handlers
function handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = plotCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = -e.deltaY * 0.001;
    const oldZoom = zoom;
    zoom = Math.max(0.1, Math.min(10, zoom * (1 + delta)));

    // Zoom toward mouse position
    panX = mouseX - (mouseX - panX) * (zoom / oldZoom);
    panY = mouseY - (mouseY - panY) * (zoom / oldZoom);
}

function handleMouseDown(e: MouseEvent): void {
    // Ignore right-click for dragging; it's reserved for context menu
    if (e.button === 2) {
        return;
    }
    const rect = plotCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const [worldX, worldY] = screenToWorld(mouseX, mouseY);

    dragStartX = mouseX;
    dragStartY = mouseY;

    // Check if clicking on resize handle
    if (selectedEntityId) {
        const entity = entities.find(ent => ent.id === selectedEntityId);
        if (entity) {
            const bounds = getEntityBounds(entity);
            const handle = getHandleAtPosition(bounds, worldX, worldY);
            if (handle) {
                isResizingEntity = true;
                resizeHandle = handle;
                return;
            }
        }
    }

    // Check if clicking on entity
    const clickedEntity = getEntityAtPosition(worldX, worldY);
    if (clickedEntity) {
        selectedEntityId = clickedEntity.id;
        isDraggingEntity = true;
    } else {
        selectedEntityId = null;
        isDraggingViewport = true;
    }
}

function handleMouseMove(e: MouseEvent): void {
    const rect = plotCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const [worldX, worldY] = screenToWorld(mouseX, mouseY);

    if (isDraggingViewport) {
        panX += mouseX - dragStartX;
        panY += mouseY - dragStartY;
        dragStartX = mouseX;
        dragStartY = mouseY;
    } else if (isDraggingEntity && selectedEntityId) {
        const entity = entities.find(e => e.id === selectedEntityId);
        if (entity) {
            const dx = (mouseX - dragStartX) / zoom;
            const dy = -(mouseY - dragStartY) / zoom; // Flip Y to match coordinate system
            translateEntity(entity, dx, dy);
            dragStartX = mouseX;
            dragStartY = mouseY;
        }
    } else if (isResizingEntity && selectedEntityId && resizeHandle) {
        const entity = entities.find(e => e.id === selectedEntityId);
        if (entity) {
            scaleEntity(entity, resizeHandle, worldX, worldY);
        }
    }

    // Update cursor
    updateCursor(worldX, worldY);
}

function handleMouseUp(): void {
    isDraggingViewport = false;
    isDraggingEntity = false;
    isResizingEntity = false;
    resizeHandle = null;
}

function handleDoubleClick(e: MouseEvent): void {
    const rect = plotCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const [worldX, worldY] = screenToWorld(mouseX, mouseY);

    // Add new circle at click position
    const newCircle: PlotEntity = {
        id: `circle${Date.now()}`,
        paths: createSquarePath(worldX, worldY, 40)
    };
    entities.push(newCircle);
}

function handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
    const rect = plotCanvas.getBoundingClientRect();
    contextClickScreenX = e.clientX - rect.left;
    contextClickScreenY = e.clientY - rect.top;
    const [worldX, worldY] = screenToWorld(contextClickScreenX, contextClickScreenY);
    showContextMenu(e.clientX, e.clientY, worldX, worldY);
}

function showContextMenu(screenX: number, screenY: number, worldX: number, worldY: number): void {
    hideContextMenu();

    contextMenu = document.createElement('div');
    contextMenu.style.position = 'fixed';
    contextMenu.style.left = `${screenX}px`;
    contextMenu.style.top = `${screenY}px`;
    contextMenu.style.background = '#2b2b2b';
    contextMenu.style.border = '1px solid #444';
    contextMenu.style.borderRadius = '6px';
    contextMenu.style.padding = '6px';
    contextMenu.style.zIndex = '9999';
    contextMenu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    contextMenu.style.minWidth = '160px';

    const addButton = (label: string, onClick: () => void) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.background = '#3a3a3a';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.textAlign = 'left';
        btn.style.padding = '8px 10px';
        btn.style.margin = '2px 0';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.onmouseenter = () => { btn.style.background = '#4a4a4a'; };
        btn.onmouseleave = () => { btn.style.background = '#3a3a3a'; };
        btn.onclick = () => {
            onClick();
            hideContextMenu();
        };
        contextMenu!.appendChild(btn);
    };

    addButton('Add Square', () => {
        const newSquare: PlotEntity = {
            id: `square${Date.now()}`,
            paths: createSquarePath(worldX, worldY, 40)
        };
        entities.push(newSquare);
    });

    addButton('Add Circle', () => {
        const newCircle: PlotEntity = {
            id: `circle${Date.now()}`,
            paths: createCirclePaths(worldX, worldY, 40)
        };
        entities.push(newCircle);
    });

    addButton('Add Axes', () => {
        const newAxes: PlotEntity = {
            id: `axes${Date.now()}`,
            paths: createAxesPaths(worldX, worldY, 100, 10)
        };
        entities.push(newAxes);
    });

    addButton('Add Date/Time', () => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const text = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
        const textPaths = textToPaths(text, worldX, worldY, 12);
        const newText: PlotEntity = {
            id: `text${Date.now()}`,
            paths: textPaths
        };
        entities.push(newText);
    });

    addButton('pikachu', () => {
        const newPikachu: PlotEntity = {
            id: `pikachu${Date.now()}`,
            paths: createPikachuPath(worldX, worldY, 40)
        };
        entities.push(newPikachu);
    });

    document.body.appendChild(contextMenu);
}

function hideContextMenu(): void {
    if (contextMenu && contextMenu.parentElement) {
        contextMenu.parentElement.removeChild(contextMenu);
    }
    contextMenu = null;
}

function screenToWorld(screenX: number, screenY: number): [number, number] {
    // Convert screen to plotter coordinates (0,0 at bottom-left)
    // Screen Y increases downward, plotter Y increases upward
    return [
        (screenX - panX) / zoom,
        -(screenY - panY) / zoom  // Flip Y
    ];
}

function getEntityAtPosition(x: number, y: number): PlotEntity | null {
    for (let i = entities.length - 1; i >= 0; i--) {
        const entity = entities[i];
        const bounds = getEntityBounds(entity);

        // Simple bounding box check
        if (x >= bounds.x && x <= bounds.x + bounds.width &&
            y >= bounds.y && y <= bounds.y + bounds.height) {
            return entity;
        }
    }
    return null;
}

function getHandleAtPosition(bounds: { x: number; y: number; width: number; height: number }, x: number, y: number): string | null {
    const handleSize = 8 / zoom;
    const handles = getResizeHandles(bounds);

    for (const handle of handles) {
        if (Math.abs(x - handle.x) < handleSize && Math.abs(y - handle.y) < handleSize) {
            return handle.id;
        }
    }
    return null;
}

// Translate (move) an entity
function translateEntity(entity: PlotEntity, dx: number, dy: number): void {
    entity.paths = entity.paths.map(path =>
        path.map(([x, y]) => [x + dx, y + dy] as [number, number])
    );
}

// Scale an entity from a resize handle (maintains aspect ratio)
function scaleEntity(entity: PlotEntity, handle: string, worldX: number, worldY: number): void {
    const oldBounds = getEntityBounds(entity);
    const minSize = 10;

    let newBounds = { ...oldBounds };
    let scaleFactor: number;

    switch (handle) {
        case 'se':
            // Calculate scale based on distance from opposite corner
            const seDistance = Math.sqrt(Math.pow(worldX - oldBounds.x, 2) + Math.pow(worldY - oldBounds.y, 2));
            const seOriginalDistance = Math.sqrt(Math.pow(oldBounds.width, 2) + Math.pow(oldBounds.height, 2));
            scaleFactor = Math.max(minSize / Math.min(oldBounds.width, oldBounds.height), seDistance / seOriginalDistance);
            newBounds.width = oldBounds.width * scaleFactor;
            newBounds.height = oldBounds.height * scaleFactor;
            break;
        case 'sw':
            // Calculate scale based on distance from opposite corner
            const swDistance = Math.sqrt(Math.pow(oldBounds.x + oldBounds.width - worldX, 2) + Math.pow(worldY - oldBounds.y, 2));
            const swOriginalDistance = Math.sqrt(Math.pow(oldBounds.width, 2) + Math.pow(oldBounds.height, 2));
            scaleFactor = Math.max(minSize / Math.min(oldBounds.width, oldBounds.height), swDistance / swOriginalDistance);
            newBounds.width = oldBounds.width * scaleFactor;
            newBounds.height = oldBounds.height * scaleFactor;
            newBounds.x = oldBounds.x + oldBounds.width - newBounds.width;
            break;
        case 'ne':
            // Calculate scale based on distance from opposite corner
            const neDistance = Math.sqrt(Math.pow(worldX - oldBounds.x, 2) + Math.pow(oldBounds.y + oldBounds.height - worldY, 2));
            const neOriginalDistance = Math.sqrt(Math.pow(oldBounds.width, 2) + Math.pow(oldBounds.height, 2));
            scaleFactor = Math.max(minSize / Math.min(oldBounds.width, oldBounds.height), neDistance / neOriginalDistance);
            newBounds.width = oldBounds.width * scaleFactor;
            newBounds.height = oldBounds.height * scaleFactor;
            newBounds.y = oldBounds.y + oldBounds.height - newBounds.height;
            break;
        case 'nw':
            // Calculate scale based on distance from opposite corner
            const nwDistance = Math.sqrt(Math.pow(oldBounds.x + oldBounds.width - worldX, 2) + Math.pow(oldBounds.y + oldBounds.height - worldY, 2));
            const nwOriginalDistance = Math.sqrt(Math.pow(oldBounds.width, 2) + Math.pow(oldBounds.height, 2));
            scaleFactor = Math.max(minSize / Math.min(oldBounds.width, oldBounds.height), nwDistance / nwOriginalDistance);
            newBounds.width = oldBounds.width * scaleFactor;
            newBounds.height = oldBounds.height * scaleFactor;
            newBounds.x = oldBounds.x + oldBounds.width - newBounds.width;
            newBounds.y = oldBounds.y + oldBounds.height - newBounds.height;
            break;
    }

    // Transform all paths using uniform scaling
    entity.paths = entity.paths.map(path =>
        path.map(([x, y]) => {
            const relX = (x - oldBounds.x) * scaleFactor;
            const relY = (y - oldBounds.y) * scaleFactor;
            return [newBounds.x + relX, newBounds.y + relY] as [number, number];
        })
    );
}

function updateCursor(worldX: number, worldY: number): void {
    if (selectedEntityId) {
        const entity = entities.find(e => e.id === selectedEntityId);
        if (entity) {
            const bounds = getEntityBounds(entity);
            const handle = getHandleAtPosition(bounds, worldX, worldY);
            if (handle) {
                plotCanvas.style.cursor = getCursorForHandle(handle);
                return;
            }
        }
    }

    const entity = getEntityAtPosition(worldX, worldY);
    plotCanvas.style.cursor = entity ? 'move' : 'grab';
}

function getCursorForHandle(handle: string): string {
    const cursors: Record<string, string> = {
        'nw': 'ne-resize',  // Dragging NW corner - cursor should point NW
        'ne': 'nw-resize',  // Dragging NE corner - cursor should point NE
        'sw': 'se-resize',  // Dragging SW corner - cursor should point SW
        'se': 'sw-resize'   // Dragging SE corner - cursor should point SE
    };
    return cursors[handle] || 'default';
}

// Convert plot entities to plotter paths (now just flatten and round coordinates)
function entitiesToPaths(entities: PlotEntity[]): [number, number][][] {
    const paths: [number, number][][] = [];

    entities.forEach(entity => {
        entity.paths.forEach(path => {
            if (path.length > 0) {
                // Round all coordinates for the plotter
                const roundedPath = path.map(([x, y]) => [Math.round(x), Math.round(y)] as [number, number]);
                paths.push(roundedPath);
            }
        });
    });

    return paths;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

