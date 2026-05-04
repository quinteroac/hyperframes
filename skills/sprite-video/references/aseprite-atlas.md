# Aseprite Atlas Reference

Use an Aseprite-compatible JSON atlas next to every generated spritesheet.

## Minimal Shape

```json
{
  "frames": {
    "hero_0000": {
      "frame": { "x": 0, "y": 0, "w": 256, "h": 256 },
      "duration": 83,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 256, "h": 256 },
      "sourceSize": { "w": 256, "h": 256 }
    },
    "hero_0001": {
      "frame": { "x": 256, "y": 0, "w": 256, "h": 256 },
      "duration": 83,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 256, "h": 256 },
      "sourceSize": { "w": 256, "h": 256 }
    }
  },
  "meta": {
    "app": "codex",
    "format": "RGBA8888",
    "size": { "w": 512, "h": 256 },
    "scale": "1",
    "frameTags": [{ "name": "loop", "from": 0, "to": 1, "direction": "forward" }]
  }
}
```

## Rules

- `frames` may be an object keyed by frame name or an array. Object keys should sort in playback order.
- `frame` is the rectangle inside the spritesheet.
- `sourceSize` is the original logical sprite frame size.
- `spriteSourceSize` is the offset and drawn rectangle inside `sourceSize`; use zero offsets when every frame is full-size.
- `duration` is optional because the HyperFrames helper usually uses `fps`, but include it when the source motion has authored timing.
- Keep all values in pixels and integers.
- Do not include remote URLs in the atlas.
