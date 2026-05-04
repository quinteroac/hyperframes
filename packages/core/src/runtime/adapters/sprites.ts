import type { RuntimeDeterministicAdapter } from "../types";

export type AsepriteFrameRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type AsepriteFrame = {
  frame: AsepriteFrameRect;
  duration?: number;
  spriteSourceSize?: AsepriteFrameRect;
  sourceSize?: { w: number; h: number };
};

export type AsepriteAtlas = {
  frames: Record<string, AsepriteFrame> | AsepriteFrame[];
  meta?: {
    frameTags?: Array<{ name: string; from: number; to: number; direction?: string }>;
  };
};

export type SpritePlaybackMode = "loop" | "once" | "pingpong";

export type SpriteAnchor = "top-left" | "center" | { x: number; y: number };

export type AsepriteSpriteAnimatorConfig = {
  canvas: HTMLCanvasElement;
  image?: HTMLImageElement;
  imageSrc?: string;
  atlas?: AsepriteAtlas;
  atlasSrc?: string;
  fps?: number;
  start?: number;
  duration?: number;
  mode?: SpritePlaybackMode;
  scale?: number;
  x?: number;
  y?: number;
  anchor?: SpriteAnchor;
  chromaKey?: string | [number, number, number];
  chromaTolerance?: number;
};

export type AsepriteSpriteAnimator = {
  ready: Promise<void>;
  seek: (timeSeconds: number) => void;
  pause: () => void;
  play: () => void;
  destroy: () => void;
  isLoaded: () => boolean;
  getFrameIndex: (timeSeconds: number) => number;
};

type LoadedState = {
  image: HTMLImageElement;
  frames: AsepriteFrame[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFrameRect(value: unknown): value is AsepriteFrameRect {
  return (
    isObject(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.w === "number" &&
    typeof value.h === "number"
  );
}

function isSourceSize(value: unknown): value is { w: number; h: number } {
  return isObject(value) && typeof value.w === "number" && typeof value.h === "number";
}

function isAsepriteFrame(value: unknown): value is AsepriteFrame {
  return (
    isObject(value) &&
    isFrameRect(value.frame) &&
    (value.duration === undefined || typeof value.duration === "number") &&
    (value.spriteSourceSize === undefined || isFrameRect(value.spriteSourceSize)) &&
    (value.sourceSize === undefined || isSourceSize(value.sourceSize))
  );
}

function isAsepriteAtlas(value: unknown): value is AsepriteAtlas {
  if (!isObject(value)) return false;
  const frames = value.frames;
  if (Array.isArray(frames)) return frames.every(isAsepriteFrame);
  return isObject(frames) && Object.values(frames).every(isAsepriteFrame);
}

function normalizeFrames(atlas: AsepriteAtlas): AsepriteFrame[] {
  if (Array.isArray(atlas.frames)) return atlas.frames;
  return Object.keys(atlas.frames)
    .sort()
    .map((key) => atlas.frames[key])
    .filter((frame): frame is AsepriteFrame => Boolean(frame));
}

function parseColor(
  value: string | [number, number, number] | undefined,
): [number, number, number] {
  if (Array.isArray(value)) return value;
  if (!value) return [0, 255, 0];
  const hex = value.replace("#", "").trim();
  if (hex.length !== 6) return [0, 255, 0];
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return [0, 255, 0];
  return [r, g, b];
}

export function applyChromaKeyToImageData<T extends Pick<ImageData, "data">>(
  imageData: T,
  key: string | [number, number, number] | undefined = "#00ff00",
  tolerance = 24,
): T {
  const [kr, kg, kb] = parseColor(key);
  const threshold = Math.max(0, Number(tolerance) || 0);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const dr = (data[i] ?? 0) - kr;
    const dg = (data[i + 1] ?? 0) - kg;
    const db = (data[i + 2] ?? 0) - kb;
    if (Math.sqrt(dr * dr + dg * dg + db * db) <= threshold) {
      data[i + 3] = 0;
    }
  }
  return imageData;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`[HyperFrames] Failed to load sprite image: ${src}`));
    image.src = src;
  });
}

async function loadAtlas(src: string): Promise<AsepriteAtlas> {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`[HyperFrames] Failed to load sprite atlas: ${src}`);
  }
  const atlas: unknown = await response.json();
  if (!isAsepriteAtlas(atlas)) {
    throw new Error(`[HyperFrames] Invalid sprite atlas: ${src}`);
  }
  return atlas;
}

function frameIndexForTime(
  timeSeconds: number,
  frameCount: number,
  fps: number,
  start: number,
  duration: number | undefined,
  mode: SpritePlaybackMode,
): number {
  if (frameCount <= 0) return 0;
  const localTime = Math.max(0, Number(timeSeconds) - start);
  const cappedTime = duration != null ? Math.min(localTime, Math.max(0, duration)) : localTime;
  const rawFrame = Math.floor(cappedTime * Math.max(1, fps));

  if (mode === "once") {
    return Math.min(rawFrame, frameCount - 1);
  }

  if (mode === "pingpong") {
    if (frameCount === 1) return 0;
    const cycle = frameCount * 2 - 2;
    const cycleFrame = rawFrame % cycle;
    return cycleFrame < frameCount ? cycleFrame : cycle - cycleFrame;
  }

  return rawFrame % frameCount;
}

function resolveAnchor(
  anchor: SpriteAnchor | undefined,
  width: number,
  height: number,
): { x: number; y: number } {
  if (anchor === "center") return { x: width / 2, y: height / 2 };
  if (typeof anchor === "object" && anchor) return anchor;
  return { x: 0, y: 0 };
}

export function createAsepriteSpriteAnimator(
  config: AsepriteSpriteAnimatorConfig,
): AsepriteSpriteAnimator {
  const fps = Math.max(1, Number(config.fps) || 12);
  const start = Math.max(0, Number(config.start) || 0);
  const mode = config.mode ?? "loop";
  const scale = Number.isFinite(config.scale) ? Math.max(0, Number(config.scale)) : 1;
  const x = Number(config.x) || 0;
  const y = Number(config.y) || 0;
  const ctx = config.canvas.getContext("2d");
  let loaded: LoadedState | null = null;
  let destroyed = false;
  let lastTime = 0;

  const ready = Promise.all([
    config.image
      ? Promise.resolve(config.image)
      : config.imageSrc
        ? loadImage(config.imageSrc)
        : null,
    config.atlas
      ? Promise.resolve(config.atlas)
      : config.atlasSrc
        ? loadAtlas(config.atlasSrc)
        : null,
  ]).then(([image, atlas]) => {
    if (!image || !atlas) {
      throw new Error("[HyperFrames] Sprite animator requires image/imageSrc and atlas/atlasSrc.");
    }
    loaded = { image, frames: normalizeFrames(atlas) };
    drawAt(lastTime);
  });

  const getFrameIndex = (timeSeconds: number): number =>
    frameIndexForTime(timeSeconds, loaded?.frames.length ?? 0, fps, start, config.duration, mode);

  function drawAt(timeSeconds: number): void {
    lastTime = Math.max(0, Number(timeSeconds) || 0);
    if (!ctx || !loaded || destroyed) return;

    const frame = loaded.frames[getFrameIndex(lastTime)];
    if (!frame) return;

    const src = frame.frame;
    const sourceSize = frame.sourceSize ?? { w: src.w, h: src.h };
    const sourceOffset = frame.spriteSourceSize ?? { x: 0, y: 0, w: src.w, h: src.h };
    const anchor = resolveAnchor(config.anchor, sourceSize.w * scale, sourceSize.h * scale);

    const scratch = document.createElement("canvas");
    scratch.width = src.w;
    scratch.height = src.h;
    const scratchCtx = scratch.getContext("2d");
    if (!scratchCtx) return;
    scratchCtx.drawImage(loaded.image, src.x, src.y, src.w, src.h, 0, 0, src.w, src.h);
    const imageData = scratchCtx.getImageData(0, 0, src.w, src.h);
    scratchCtx.putImageData(
      applyChromaKeyToImageData(imageData, config.chromaKey, config.chromaTolerance),
      0,
      0,
    );

    ctx.clearRect(0, 0, config.canvas.width, config.canvas.height);
    ctx.drawImage(
      scratch,
      x + sourceOffset.x * scale - anchor.x,
      y + sourceOffset.y * scale - anchor.y,
      src.w * scale,
      src.h * scale,
    );
  }

  const animator: AsepriteSpriteAnimator = {
    ready,
    seek: drawAt,
    pause: () => {},
    play: () => {},
    destroy: () => {
      destroyed = true;
      const sprites = window.__hfSprites;
      if (sprites) {
        window.__hfSprites = sprites.filter((sprite) => sprite !== animator);
      }
    },
    isLoaded: () => Boolean(loaded),
    getFrameIndex,
  };

  window.__hfSprites = window.__hfSprites || [];
  window.__hfSprites?.push(animator);

  return animator;
}

export function createSpriteAdapter(): RuntimeDeterministicAdapter {
  return {
    name: "sprites",
    discover: () => {},
    seek: (ctx) => {
      const sprites = window.__hfSprites;
      if (!sprites || sprites.length === 0) return;
      const time = Math.max(0, Number(ctx.time) || 0);
      for (const sprite of sprites) {
        try {
          sprite.seek(time);
        } catch {
          // keep other sprite instances seekable
        }
      }
    },
    pause: () => {
      for (const sprite of window.__hfSprites ?? []) {
        try {
          sprite.pause();
        } catch {
          // ignore
        }
      }
    },
    play: () => {
      for (const sprite of window.__hfSprites ?? []) {
        try {
          sprite.play();
        } catch {
          // ignore
        }
      }
    },
    revert: () => {},
  };
}
