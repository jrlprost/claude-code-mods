# jr-image-guard

The API refuses images over about 8000 px on a side, and a refused image breaks the turn. This mod keeps them out:

- When Claude reads an image (PNG, JPEG, WebP, GIF, TIFF, HEIC, BMP) larger than the limit on either side, it reads a resized copy instead. Your file is never touched; the copy goes to `/tmp/jr-image-guard`. A toast says what happened.
- A Playwright browser viewport larger than the limit is refused, so the screenshots taken from it stay readable.

Resizing uses ImageMagick when it is installed, `sips` otherwise (macOS).

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Largest side (px) | 7800 | Images larger than this on either side are resized |

## Install

```
/plugin install jr-image-guard --marketplace jrlprost/claude-code-mods
```

## Access

Runs `sips` (and `magick` when present) on images Claude is about to read. Writes resized copies to `/tmp/jr-image-guard`. Sends nothing over the network.
