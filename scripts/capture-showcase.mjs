import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const baseURL = process.env.SHOWCASE_URL || 'http://127.0.0.1:5173';
const output = 'public/showcase';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(baseURL); await page.waitForFunction(() => window.avatarStudio);
  await page.locator('[data-preset="0"]').click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${output}/studio.png` });
  await page.locator('#classroom-tab').click();
  await page.waitForFunction(() => window.avatarStudio.getClassroomStats(), {}, { timeout: 120000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${output}/classroom-lesson.png` });
  await page.locator('[data-scenario="break"]').click();
  await page.locator('#language-toggle').click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${output}/classroom-break-en.png` });
} finally { await browser.close(); }
