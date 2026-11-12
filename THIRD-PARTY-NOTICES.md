# Third-party notices

## Bundled in the extension

### qrcode-generator

`extension/src/vendor/qrcode.js` (QR code for the Support box; the Pix code itself is built locally in `src/apoio.js`). Used unchanged.

- Project: <https://github.com/kazuhikoarase/qrcode-generator>
- Author: Kazuhiko Arase
- License: MIT

```
The MIT License (MIT)

Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Test assets (not shipped in the zip)

- `tests/media/clip.webm`: made for these tests with ffmpeg (`testsrc2` pattern and a 440 Hz sine), no third-party content.
- `tests/fixtures/feed.json`: the *shape* of TikTok's feed responses, measured on the logged-out site; every creator, caption, sound, effect and id in it was replaced with made-up data.

## Test tooling (not shipped in the zip)

- [Playwright](https://github.com/microsoft/playwright) 1.63.0, Apache-2.0.
