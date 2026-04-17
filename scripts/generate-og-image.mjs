import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const outputSvgPath = path.join(publicDir, 'og-image.svg');
const outputPngPath = path.join(publicDir, 'og-image.png');

const colors = {
  accent: '#67b4ff',
  background: '#010205',
  backgroundSoft: '#050913',
  laser: '#f5f7ff',
  ship: '#f8fbff',
  text: '#edf4ff',
  warning: '#ff8a5b',
};

const stars = [
  [12, 28, 1.6],
  [38, 130, 1.2],
  [64, 60, 0.9],
  [90, 210, 1.4],
  [118, 34, 1.1],
  [140, 162, 1.3],
  [180, 96, 1.5],
  [204, 48, 0.8],
  [222, 188, 1.6],
  [236, 118, 1],
];

const largeAsteroidOutline = [
  [0.18, 1],
  [0.9, 0.52],
  [0.98, -0.12],
  [0.48, -0.86],
  [-0.12, -1],
  [-0.76, -0.64],
  [-1, 0.02],
  [-0.76, 0.72],
];

const smallAsteroidOutline = [
  [0.1, 0.96],
  [0.92, 0.24],
  [0.7, -0.62],
  [-0.08, -0.98],
  [-0.86, -0.42],
  [-0.72, 0.66],
];

const starPattern = stars.map(([x, y, radius]) => `
    <circle cx="${x}" cy="${y}" r="${radius + 2}" fill="${colors.accent}" fill-opacity="0.22" />
    <circle cx="${x}" cy="${y}" r="${radius}" fill="${colors.ship}" fill-opacity="0.8" />
  `).join('');

function polygonPoints(centerX, centerY, radius, outline) {
  return outline
    .map(([x, y]) => `${(centerX + x * radius).toFixed(2)},${(centerY + y * radius).toFixed(2)}`)
    .join(' ');
}

const largeAsteroidPoints = polygonPoints(0, 0, 112, largeAsteroidOutline);
const smallAsteroidPoints = polygonPoints(0, 0, 54, smallAsteroidOutline);

const ogSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800&amp;display=swap');
      .og-title {
        font-family: 'Orbitron', sans-serif;
        font-size: 92px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
    </style>
    <linearGradient id="shell-bg" x1="600" y1="0" x2="600" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${colors.backgroundSoft}" />
      <stop offset="0.58" stop-color="${colors.background}" />
      <stop offset="1" stop-color="#000000" />
    </linearGradient>
    <radialGradient id="shell-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(600 18) rotate(90) scale(280 720)">
      <stop offset="0" stop-color="${colors.accent}" stop-opacity="0.08" />
      <stop offset="1" stop-color="${colors.accent}" stop-opacity="0" />
    </radialGradient>
    <pattern id="stars-near" width="256" height="256" patternUnits="userSpaceOnUse" patternTransform="translate(-120 -70) scale(3.35)">
      <rect width="256" height="256" fill="${colors.background}" />
${starPattern}
    </pattern>
    <pattern id="stars-far" width="256" height="256" patternUnits="userSpaceOnUse" patternTransform="translate(40 28) scale(2.7)">
      <rect width="256" height="256" fill="transparent" />
${starPattern}
    </pattern>
    <filter id="viewport-distort" x="-5%" y="-5%" width="110%" height="110%">
      <feGaussianBlur stdDeviation="1" />
      <feColorMatrix type="matrix" values="
        0.96 0 0 0 0
        0 1 0 0 0
        0 0 1.03 0 0
        0 0 0 1 0" />
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#shell-bg)" />
  <rect width="1200" height="630" fill="url(#shell-glow)" />

  <g filter="url(#viewport-distort)">
    <rect width="1200" height="630" fill="url(#stars-far)" opacity="0.45" />
    <rect width="1200" height="630" fill="url(#stars-near)" opacity="0.92" style="mix-blend-mode:screen" />

    <text class="og-title" x="600" y="120" fill="${colors.text}" text-anchor="middle">ASTEROIDS</text>

    <g transform="translate(936 264) rotate(18)">
      <polygon
        points="${largeAsteroidPoints}"
        fill="${colors.warning}"
        fill-opacity="0.08"
        stroke="${colors.warning}"
        stroke-opacity="0.95"
        stroke-width="3"
        stroke-linejoin="round"
      />
    </g>

    <g transform="translate(1012 408) rotate(-12)">
      <polygon
        points="${smallAsteroidPoints}"
        fill="${colors.warning}"
        fill-opacity="0.08"
        stroke="${colors.warning}"
        stroke-opacity="0.95"
        stroke-width="3"
        stroke-linejoin="round"
      />
    </g>

    <g transform="translate(392 346) rotate(54 32 32) scale(1.65)">
      <path
        d="M32 8 52 46l-14-6-6 16-6-16-14 6L32 8Z"
        fill="${colors.ship}"
        fill-opacity="0.14"
        stroke="${colors.ship}"
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path d="m32 16 6 18H26l6-18Z" fill="${colors.accent}" />
    </g>

    <g transform="translate(454 346) rotate(-7 0 0)">
      <rect x="0" y="0" width="156" height="8" rx="4" fill="${colors.laser}" />
      <rect x="0" y="0" width="156" height="8" rx="4" stroke="${colors.accent}" stroke-width="1" />
    </g>
  </g>
</svg>
`;

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800&display=swap');

      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: 1200px;
        height: 630px;
        margin: 0;
        overflow: hidden;
        background: #000;
      }

      body {
        position: relative;
      }

      .frame {
        position: relative;
        width: 1200px;
        height: 630px;
        overflow: hidden;
        background:
          radial-gradient(circle at top, rgba(103, 180, 255, 0.08), transparent 38%),
          linear-gradient(180deg, ${colors.backgroundSoft} 0%, ${colors.background} 58%, #000 100%);
        box-shadow: inset 0 0 200px rgba(0, 0, 0, 0.9);
      }

      .frame::before,
      .frame::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .frame::before {
        background: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0) 50%,
          rgba(0, 0, 0, 0.25) 50%
        );
        background-size: 100% 4px;
        z-index: 2;
      }

      .frame::after {
        background: rgba(18, 16, 16, 0.22);
        z-index: 3;
      }

      svg {
        display: block;
        width: 1200px;
        height: 630px;
      }
    </style>
  </head>
  <body>
    <div class="frame">${ogSvg}</div>
  </body>
</html>
`;

await mkdir(publicDir, { recursive: true });
await writeFile(outputSvgPath, ogSvg, 'utf8');

const browser = await chromium.launch();

try {
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { width: 1200, height: 630 },
  });

  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: outputPngPath, type: 'png' });
} finally {
  await browser.close();
}

console.log(`Generated ${path.relative(rootDir, outputSvgPath)} and ${path.relative(rootDir, outputPngPath)}`);
