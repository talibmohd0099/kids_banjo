import { expect, test, type Page } from '@playwright/test';

// Collect page errors so any crash fails the test.
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

async function openFreeViolin(page: Page) {
  await page.getByRole('button', { name: /^▶️ ?PLAY$/ }).click();
  await page.getByRole('button', { name: /Free Violin/ }).click();
}

async function bow(page: Page, lane: number, yFrac: number, strokes = 3) {
  const box = (await page.locator('canvas').boundingBox())!;
  const laneW = Math.min(box.width - 28, 560) / 4;
  const left = (box.width - laneW * 4) / 2;
  const x = box.x + left + laneW * (lane + 0.5);
  const y = box.y + 138 + (box.height - 160) * yFrac;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let s = 0; s < strokes; s++) {
    await page.mouse.move(x + laneW * 0.4, y, { steps: 8 });
    await page.mouse.move(x - laneW * 0.4, y, { steps: 8 });
  }
  return { x, y };
}

test('home shows the main menu', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Magic Violin' })).toBeVisible();
  for (const label of ['PLAY', 'SONGS', 'MAGIC ORCHESTRA', 'MUSIC GARDEN', 'MY MUSIC']) {
    await expect(page.getByRole('button', { name: new RegExp(label) })).toBeVisible();
  }
  await page.waitForTimeout(400); // let the pop-in animation finish
  await page.screenshot({ path: 'test-results/shots/home.png' });
  expect(errors).toEqual([]);
});

test('free play: bowing a string makes sound, then record and replay it', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await openFreeViolin(page);
  await page.getByRole('button', { name: 'Record my song' }).click();
  await bow(page, 2, 0.3);
  const playing = await page.evaluate(() => document.querySelector('.musician[data-id="violin"]')?.classList.contains('on'));
  expect(playing).toBe(true);
  await page.screenshot({ path: 'test-results/shots/free-play.png' });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.getByText(/Saved/)).toBeVisible();

  await page.getByRole('button', { name: /My Music/ }).click();
  await expect(page.locator('.rec-item')).toHaveCount(1);
  await page.locator('.rec-item').getByRole('button', { name: /^Play/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/shots/replay.png' });
  expect(errors).toEqual([]);
});

test('magic orchestra: the band joins when the child keeps playing', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: /MAGIC ORCHESTRA/ }).click();
  await bow(page, 1, 0.45, 12);
  await expect(page.locator('.musician[data-id="piano"]')).toHaveClass(/on/);
  await page.screenshot({ path: 'test-results/shots/orchestra.png' });
  await page.mouse.up();
  expect(errors).toEqual([]);
});

test('songs: the first song is open, the rest unlock in order, and the game runs', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: /SONGS/ }).click();
  await expect(page.locator('.song-card')).toHaveCount(10);
  await expect(page.locator('.song-card.locked')).toHaveCount(9);
  await page.screenshot({ path: 'test-results/shots/songs.png' });
  await page.getByRole('button', { name: 'Hot Cross Buns' }).click();
  await page.getByRole('button', { name: /Start/ }).click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: 'test-results/shots/game.png' });
  expect(errors).toEqual([]);
});

test('settings: switching the violin skin and note names', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /SETTINGS/ }).click();
  await page.getByRole('button', { name: /Blue Galaxy/ }).click();
  await page.getByRole('button', { name: 'Sa Re Ga' }).click();
  await page.getByRole('button', { name: /Done/ }).click();
  await openFreeViolin(page);
  await bow(page, 3, 0.2);
  await page.screenshot({ path: 'test-results/shots/galaxy.png' });
  await page.mouse.up();
});

test('core loop: home, play, violin, song, guided playing, score, reward, garden, saved', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto('/');

  // Home -> Play -> Violin, and explore until the app invites us to a song.
  await openFreeViolin(page);
  await bow(page, 1, 0.3, 12);
  await page.mouse.up();
  await page.getByRole('button', { name: /Ready to play a song/ }).click();

  // Song -> listen first -> guided playing (beginner: the song waits for each note).
  await page.getByRole('button', { name: 'Hot Cross Buns' }).click();
  await page.getByRole('button', { name: /Listen/ }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Start/ }).click();

  const screen = page.locator('.screen.stage');
  const box = (await page.locator('canvas').boundingBox())!;
  const laneW = Math.min(box.width - 28, 560) / 4;
  const left = (box.width - laneW * 4) / 2;
  const collect = page.getByRole('button', { name: /Collect reward/ });
  let taps = 0;
  for (let i = 0; i < 400 && !(await collect.isVisible()); i++) {
    const lane = await screen.getAttribute('data-next-lane');
    if (lane) {
      const x = box.x + left + laneW * (Number(lane) + 0.5);
      const y = box.y + box.height * 0.5;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.up();
      taps++;
    }
    await page.waitForTimeout(100);
  }
  // One tap = one note: a held or tapped finger must never run ahead through the melody.
  expect(taps).toBe(17);
  await expect(page.getByText('You played 17 of 17 notes.')).toBeVisible();

  // Score -> reward.
  await expect(page.locator('.big-stars')).toHaveAttribute('aria-label', '3 stars');
  await page.screenshot({ path: 'test-results/shots/score.png' });
  await collect.click();
  await expect(page.getByText('You planted a Hot Cross Buns flower!')).toBeVisible();
  await expect(page.getByText(/New song unlocked: .*Mary Had a Little Lamb/)).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/shots/reward.png' });

  // Reward -> Music Garden.
  await page.getByRole('button', { name: /Visit my Music Garden/ }).click();
  await expect(page.getByRole('button', { name: /Hot Cross Buns: a flower, played 1 times/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mary Had a Little Lamb: play it to plant a seed/ })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/shots/garden.png' });

  // Everything survives closing and reopening the app.
  await page.reload();
  await page.getByRole('button', { name: /MUSIC GARDEN/ }).click();
  await expect(page.getByRole('button', { name: /Hot Cross Buns: a flower/ })).toBeVisible();
  await expect(page.locator('.garden-stats')).toContainText('1plants');
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: /SONGS/ }).click();
  await expect(page.locator('.song-card.locked')).toHaveCount(8);
  expect(errors).toEqual([]);
});

test('listen: the fairy really plays the melody (pitch check on the audio)', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'mv.profile',
      JSON.stringify({ version: 1, songs: { 'hot-cross-buns': { bestStars: 3, plays: 1, completions: 1, bestAccuracy: 1, lastPlayed: 0 } }, stats: { notesPlayed: 0, practiceMs: 0, songsCompleted: 1, streakDays: 1, lastPracticeDay: '' } }),
    ),
  );
  await page.goto('/?debug');
  await page.getByRole('button', { name: /SONGS/ }).click();
  await page.getByRole('button', { name: 'Mary Had a Little Lamb' }).click();
  await page.getByRole('button', { name: /Listen/ }).click();
  // Listen to the audio output and name the pitch every 80 ms (autocorrelation).
  const heard: string[] = await page.evaluate(async () => {
    const { engine } = (window as unknown as { magicViolin: { engine: { ctx: AudioContext; input: AudioNode } } }).magicViolin;
    const an = engine.ctx.createAnalyser();
    an.fftSize = 4096;
    engine.input.connect(an);
    const buf = new Float32Array(an.fftSize);
    const sr = engine.ctx.sampleRate;
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const out: string[] = [];
    for (let k = 0; k < 70; k++) {
      await new Promise((r) => setTimeout(r, 80));
      an.getFloatTimeDomainData(buf);
      let rms = 0;
      for (const v of buf) rms += v * v;
      if (Math.sqrt(rms / buf.length) < 0.01) continue;
      let best = 0;
      let bestLag = 0;
      for (let lag = Math.floor(sr / 1000); lag < sr / 180; lag++) {
        let c = 0;
        for (let i = 0; i < 2048; i++) c += buf[i] * buf[i + lag];
        if (c > best) {
          best = c;
          bestLag = lag;
        }
      }
      const m = Math.round(69 + 12 * Math.log2(sr / bestLag / 440));
      out.push(names[((m % 12) + 12) % 12]);
    }
    return out;
  });
  const melody = heard.filter((n, i) => n !== heard[i - 1]);
  // "Ma-ry had a lit-tle lamb" = F# E D E F#
  expect(melody.slice(0, 5)).toEqual(['F#', 'E', 'D', 'E', 'F#']);
});
