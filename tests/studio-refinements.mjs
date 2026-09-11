import { chromium } from '@playwright/test';
import { validateBytes } from 'gltf-validator';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createAvatar } from '../src/avatar.js';
import { DEFAULT, PRESETS } from '../src/config.js';

const adult = createAvatar(DEFAULT), child = createAvatar({ ...DEFAULT, age: 'child' });
try {
  const faceSize = avatar => { const g = avatar.parts.find(p => p.name === 'Face').geometry; g.computeBoundingBox(); return g.boundingBox.max.x - g.boundingBox.min.x; };
  assert.ok(faceSize(child) / faceSize(adult) < .85);
  assert.ok(child.shoulderX < adult.shoulderX * .90);
  assert.ok(child.height < adult.height);
  for (const expression of ['smile', 'angry', 'sad', 'surprised']) {
    child.setExpression(expression, 1, 1); child.setGaze(.3, -.2); child.pose('look', .5);
    for (const part of child.facial) assert.ok(part.morphTargetInfluences.every(Number.isFinite));
  }
} finally { adult.dispose(); child.dispose(); }
const traits = ['eyeSize', 'eyeRoundness', 'eyeAlmond', 'eyeTilt', 'eyeSpacing', 'noseSize', 'noseWidth', 'browShape', 'jaw'];
assert.equal(new Set(PRESETS.map(p => JSON.stringify(traits.map(k => p[k])))).size, 12);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await mkdir('test-results', { recursive: true });
try {
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.avatarStudio && document.querySelectorAll('.preset-img.loaded').length === 12, {}, { timeout: 120000 });
  for (let i = 0; i < 12; i++) {
    await page.locator(`[data-preset="${i}"]`).click();
    const config = await page.evaluate(() => window.avatarStudio.getConfig());
    assert.equal(config.name, PRESETS[i].name);
    for (const key of traits) assert.equal(config[key], PRESETS[i][key]);
  }
  await page.locator('[data-preset="4"]').click();
  await page.locator('#pose').selectOption('cross');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/child-crossed-arms.png' });
  await page.locator('#pose').selectOption('relaxed');
  await page.screenshot({ path: 'test-results/studio-curated-collection.png' });
  const variants = ['overalls', 'vest', 'jacket', 'cardigan', 'polo'].map(shirt => ({ shirt, age: 'adult' }));
  variants.push({ shirt: 'hoodie', age: 'child' }, { shirt: 'overalls', age: 'child' });
  for (const variant of variants) {
    await page.evaluate(variant => window.avatarStudio.setConfig({ ...window.avatarStudio.presets[0], ...variant }), variant);
    const encoded = await page.evaluate(async () => {
      const bytes = new Uint8Array(await window.avatarStudio.exportGLB());
      let data = ''; for (let i = 0; i < bytes.length; i += 32768) data += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return btoa(data);
    });
    const report = await validateBytes(new Uint8Array(Buffer.from(encoded, 'base64')), { maxIssues: 30 });
    assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues));
    assert.equal(report.issues.numWarnings, 0, JSON.stringify(report.issues));
    console.log(`${variant.age} ${variant.shirt}: GLB validated`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log('PASS: 12 distinct selectable faces, child proportions, crossed-arm mode, 7 clean GLB exports, mobile layout.');
} finally { await browser.close(); }
