import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyChromaKeyToImageData,
  createAsepriteSpriteAnimator,
  createSpriteAdapter,
  type AsepriteAtlas,
  type AsepriteSpriteAnimator,
} from "./sprites";

function atlas(frameCount: number): AsepriteAtlas {
  return {
    frames: Array.from({ length: frameCount }, (_, i) => ({
      frame: { x: i * 10, y: 0, w: 10, h: 10 },
      sourceSize: { w: 10, h: 10 },
    })),
  };
}

function mockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  vi.spyOn(canvas, "getContext").mockReturnValue(null);
  return canvas;
}

function mockSprite(overrides: Partial<AsepriteSpriteAnimator> = {}): AsepriteSpriteAnimator {
  return {
    ready: Promise.resolve(),
    seek: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(),
    destroy: vi.fn(),
    isLoaded: vi.fn(() => true),
    getFrameIndex: vi.fn(() => 0),
    ...overrides,
  };
}

describe("sprite adapter", () => {
  afterEach(() => {
    delete window.__hfSprites;
    vi.restoreAllMocks();
  });

  it("does nothing with no registered sprites", () => {
    const adapter = createSpriteAdapter();
    expect(() => adapter.seek({ time: 1 })).not.toThrow();
    expect(() => adapter.pause()).not.toThrow();
    expect(() => adapter.play?.()).not.toThrow();
  });

  it("seeks multiple registered sprites", () => {
    const a = mockSprite();
    const b = mockSprite();
    window.__hfSprites = [a, b];

    const adapter = createSpriteAdapter();
    adapter.seek({ time: 1.5 });

    expect(a.seek).toHaveBeenCalledWith(1.5);
    expect(b.seek).toHaveBeenCalledWith(1.5);
  });

  it("continues seeking when one sprite throws", () => {
    const bad = mockSprite({
      seek: vi.fn(() => {
        throw new Error("boom");
      }),
    });
    const good = mockSprite();
    window.__hfSprites = [bad, good];

    createSpriteAdapter().seek({ time: 2 });

    expect(good.seek).toHaveBeenCalledWith(2);
  });
});

describe("createAsepriteSpriteAnimator", () => {
  afterEach(() => {
    delete window.__hfSprites;
    vi.restoreAllMocks();
  });

  it("registers itself and calculates loop frame indices", async () => {
    const sprite = createAsepriteSpriteAnimator({
      canvas: mockCanvas(),
      image: new Image(),
      atlas: atlas(4),
      fps: 2,
      mode: "loop",
    });
    await sprite.ready;

    expect(window.__hfSprites).toContain(sprite);
    expect(sprite.getFrameIndex(0)).toBe(0);
    expect(sprite.getFrameIndex(0.5)).toBe(1);
    expect(sprite.getFrameIndex(1.5)).toBe(3);
    expect(sprite.getFrameIndex(2)).toBe(0);
  });

  it("calculates once frame indices", async () => {
    const sprite = createAsepriteSpriteAnimator({
      canvas: mockCanvas(),
      image: new Image(),
      atlas: atlas(3),
      fps: 4,
      mode: "once",
    });
    await sprite.ready;

    expect(sprite.getFrameIndex(0)).toBe(0);
    expect(sprite.getFrameIndex(0.25)).toBe(1);
    expect(sprite.getFrameIndex(10)).toBe(2);
  });

  it("calculates pingpong frame indices", async () => {
    const sprite = createAsepriteSpriteAnimator({
      canvas: mockCanvas(),
      image: new Image(),
      atlas: atlas(4),
      fps: 1,
      mode: "pingpong",
    });
    await sprite.ready;

    expect([0, 1, 2, 3, 4, 5, 6].map((time) => sprite.getFrameIndex(time))).toEqual([
      0, 1, 2, 3, 2, 1, 0,
    ]);
  });

  it("applies start and duration to frame selection", async () => {
    const sprite = createAsepriteSpriteAnimator({
      canvas: mockCanvas(),
      image: new Image(),
      atlas: atlas(4),
      fps: 2,
      start: 1,
      duration: 1,
      mode: "once",
    });
    await sprite.ready;

    expect(sprite.getFrameIndex(0.5)).toBe(0);
    expect(sprite.getFrameIndex(1.5)).toBe(1);
    expect(sprite.getFrameIndex(5)).toBe(2);
  });
});

describe("applyChromaKeyToImageData", () => {
  it("makes chroma pixels transparent and preserves other pixels", () => {
    const data = new Uint8ClampedArray([0, 255, 0, 255, 255, 0, 0, 255]);
    const imageData = { data };

    applyChromaKeyToImageData(imageData, "#00ff00", 0);

    expect(imageData.data[3]).toBe(0);
    expect(imageData.data[7]).toBe(255);
  });

  it("uses tolerance for near-key pixels", () => {
    const data = new Uint8ClampedArray([0, 250, 8, 255]);
    const imageData = { data };

    applyChromaKeyToImageData(imageData, "#00ff00", 12);

    expect(imageData.data[3]).toBe(0);
  });
});
