/**
 * Render product-boundaries.mmd using beautiful-mermaid
 *
 * Usage:
 *   npm install beautiful-mermaid
 *   npx tsx diagrams/mermaid/render-product-boundaries.ts [theme]
 *
 * Examples:
 *   npx tsx diagrams/mermaid/render-product-boundaries.ts              # tokyo-night (default)
 *   npx tsx diagrams/mermaid/render-product-boundaries.ts github-dark
 *   npx tsx diagrams/mermaid/render-product-boundaries.ts nord
 *   npx tsx diagrams/mermaid/render-product-boundaries.ts all          # render all themes
 *
 * Output: diagrams/mermaid/rendered/product-boundaries[-theme].svg
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMermaid, THEMES } from 'beautiful-mermaid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputPath = resolve(__dirname, 'product-boundaries.mmd');
const outputDir = resolve(__dirname, 'rendered');

const diagram = readFileSync(inputPath, 'utf-8');

const renderOpts = {
  font: 'Inter',
  padding: 48,
  nodeSpacing: 28,
  layerSpacing: 44,
};

async function render(themeName: string) {
  const theme = THEMES[themeName];
  if (!theme) {
    console.error(`Unknown theme: ${themeName}`);
    console.error(`Available: ${Object.keys(THEMES).join(', ')}`);
    process.exit(1);
  }

  const svg = await renderMermaid(diagram, { ...theme, ...renderOpts });

  mkdirSync(outputDir, { recursive: true });
  const suffix = themeName === 'tokyo-night' ? '' : `-${themeName}`;
  const outputPath = resolve(outputDir, `product-boundaries${suffix}.svg`);
  writeFileSync(outputPath, svg, 'utf-8');
  console.log(`  ${themeName} → ${outputPath}`);
}

async function main() {
  const arg = process.argv[2] || 'tokyo-night';

  console.log('Rendering product-boundaries.mmd with beautiful-mermaid\n');

  if (arg === 'all') {
    for (const name of Object.keys(THEMES)) {
      await render(name);
    }
  } else {
    await render(arg);
  }

  console.log('\nDone.');
}

main().catch(console.error);
