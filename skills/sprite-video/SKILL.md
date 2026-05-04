---
name: sprite-video
description: Create HyperFrames videos from text prompts or user-provided images using GPT Image/imagegen-generated raster backgrounds, chroma-key raster spritesheets, and Aseprite-style JSON atlases. Use when asked for sprite animation, animated still images, image-to-video, character/object sprite motion, spritesheets, chroma key, Aseprite atlas files, or a video where Codex should generate or edit images before assembling a HyperFrames composition. Codex has image generation and image editing capability in this environment; other agents may also use this skill when they have a real image generation or editing tool through MCP, API, or another callable integration.
---

# Sprite Video

Build sprite-based HyperFrames videos from either a text prompt or an image supplied by the user.

Codex can generate and edit images in this environment. Use the `imagegen` skill and GPT Image/image generation tools when the workflow needs a base image, clean background plate, sprite frames, or spritesheet. If another agent has image generation through MCP, API, or a tool, it may use the same workflow. If no real image tool is available, ask the user for the background, spritesheets, and atlases instead of claiming they were generated.

## Image Generation Requirement

- Use raster image generation/editing for visual assets. In Codex, invoke the `imagegen` skill and built-in image generation/editing path by default.
- Do not create the base image, background plate, spritesheet, or sprite frames as SVG, canvas drawing code, HTML/CSS art, vector placeholders, or manually authored geometric assets.
- Do not use SVG as an intermediate asset to later rasterize. The source of visual truth must be generated or edited bitmap imagery.
- It is acceptable to write JSON atlas files and HTML/JS composition code by hand; those are structural assets, not generated visual art.
- If the user asks for a quick prototype and no image tool is available, stop and request raster assets from the user rather than fabricating vector stand-ins.

## Workflow

1. Identify the input:
   - Text prompt: use `imagegen`/GPT Image to generate a complete raster base image first.
   - User image: use `imagegen`/GPT Image editing to preserve the provided composition, style, lighting, and perspective while preparing animation assets.
2. Decide which elements should animate. Pick a small set of high-value objects or characters rather than animating everything.
3. Create `assets/sprites/background.png` as a clean raster plate with animated elements removed or filled in through image editing.
4. For each animated element, generate `assets/sprites/<name>.png` as a raster spritesheet on a uniform chroma background, usually `#00ff00`.
5. Create `assets/sprites/<name>.json` using Aseprite-compatible frame metadata. Read [aseprite-atlas.md](./references/aseprite-atlas.md) when writing or validating atlas shape.
6. Build `index.html` with the clean background as the base layer and one canvas per sprite.
7. Register each canvas with `window.__hyperframes.createAsepriteSpriteAnimator`.
8. Register a paused GSAP timeline on `window.__timelines["<composition-id>"]`.
9. Run `npx hyperframes lint`, `npx hyperframes validate`, then preview or render.

## Asset Rules

- Keep all generated assets local. Do not rely on render-time network fetches.
- Visual assets must be bitmap files generated or edited with image generation tools, usually PNG or WebP.
- Use stable lowercase filenames such as `hero-bird.png` and `hero-bird.json`.
- Keep spritesheet frame dimensions integer and consistent when possible.
- Add padding between frames so chroma cleanup does not bleed into adjacent frames.
- Use a chroma color that does not appear in the sprite. Default to `#00ff00`; switch to magenta or blue only when the art already contains strong green.
- Prefer PNG or WebP with alpha when already available, but still support chroma key because this skill's v1 contract is chroma-key spritesheets.
- Generate spritesheets as pose/frame progressions, not unrelated images. Maintain silhouette, lighting, scale, and camera angle across frames.
- Do not create `.svg` source files for backgrounds or spritesheets in this workflow.

## Composition Pattern

```html
<div
  id="main"
  data-composition-id="main"
  data-start="0"
  data-duration="6"
  data-width="1920"
  data-height="1080"
>
  <img
    id="background"
    class="clip"
    data-start="0"
    data-duration="6"
    data-track-index="0"
    src="assets/sprites/background.png"
  />
  <canvas
    id="sprite-hero"
    class="clip sprite-layer"
    data-start="0"
    data-duration="6"
    data-track-index="1"
  ></canvas>

  <style>
    [data-composition-id="main"] {
      position: relative;
      overflow: hidden;
      background: #000;
    }
    #background,
    .sprite-layer {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  </style>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <script>
    const canvas = document.getElementById("sprite-hero");
    canvas.width = 1920;
    canvas.height = 1080;

    window.__hyperframes.createAsepriteSpriteAnimator({
      canvas,
      imageSrc: "assets/sprites/hero.png",
      atlasSrc: "assets/sprites/hero.json",
      fps: 12,
      mode: "loop",
      start: 0,
      duration: 6,
      x: 960,
      y: 620,
      anchor: "center",
      scale: 1,
      chromaKey: "#00ff00",
      chromaTolerance: 28,
    });

    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.from("#sprite-hero", { opacity: 0, y: 24, duration: 0.4, ease: "power2.out" }, 0);
    window.__timelines["main"] = tl;
  </script>
</div>
```

## Motion Guidance

- Let the sprite frames handle body motion, flapping, blinking, waving, smoke, flames, cloth, water, or object motion.
- Use GSAP only for camera-like moves, sprite layer entrance, parallax, scale, position, or final fade.
- Keep frame selection deterministic through the sprite helper. Do not drive sprites with `Date.now`, timers, or free-running animation loops.
- For multiple sprites, make each canvas full-frame unless a tightly cropped canvas is easier to position and inspect.
- Keep the clean background visually plausible where elements were removed. The viewer should not see holes or duplicated artifacts after sprites move.

## Validation

Run these after creating or editing the composition:

```bash
npx hyperframes lint
npx hyperframes validate
```

Before rendering, scrub or inspect frames where sprites move fastest. Check chroma edges, frame alignment, scale consistency, and whether the cleaned background is exposed.
