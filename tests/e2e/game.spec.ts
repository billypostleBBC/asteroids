import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.setLeaderboardEntries([]);
    window.__ASTEROIDS_TEST_API__?.setLeaderboardFailure({
      failLoad: false,
      failSubmit: false,
    });
  });
  await page.evaluate(() => window.__ASTEROIDS_TEST_API__?.refreshLeaderboard());
});

test('loads into the menu and launches with Space with the ship centred', async ({
  page,
}) => {
  await expect(page.getByRole('button', { name: 'Tap to launch' })).toBeVisible();

  await page.keyboard.press('Space');

  await expect.poll(() => readMode(page)).toBe('playing');

  const snapshot = await readSnapshot(page);

  expect(snapshot.showShip).toBe(true);
  expect(snapshot.ship.position.x).toBeCloseTo(0, 4);
  expect(snapshot.ship.position.y).toBeCloseTo(0, 4);
  expect(await page.locator('#screen-overlay.screen-overlay--visible').count()).toBe(0);
});

test('fires the ship weapon with Space', async ({ page }) => {
  await launchWithButton(page);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.freezeSpawns();
    window.__ASTEROIDS_TEST_API__?.setShipState({ fireCooldownMs: 0 });
    window.__ASTEROIDS_TEST_API__?.clearEntities();
  });

  const before = await readSnapshot(page);

  await page.keyboard.press('Space');

  await expect
    .poll(async () => (await readSnapshot(page)).projectiles.length)
    .toBeGreaterThan(before.projectiles.length);
});

test('audio starts locked, unlocks on launch, and keeps ambient active during play', async ({
  page,
}) => {
  const initialAudio = await readAudioState(page);

  expect(initialAudio.unlocked).toBe(false);
  expect(initialAudio.ambientActive).toBe(false);

  await launchWithButton(page);

  await expect.poll(async () => (await readAudioState(page)).unlocked).toBe(true);
  await expect.poll(async () => (await readAudioState(page)).ambientActive).toBe(true);
});

test('thrust loop activates while thrust is held and drops out on release and pause', async ({
  page,
}) => {
  await launchWithButton(page);

  await page.keyboard.down('w');
  await expect.poll(async () => (await readAudioState(page)).thrustActive).toBe(true);

  await page.keyboard.up('w');
  await expect.poll(async () => (await readAudioState(page)).thrustActive).toBe(false);

  await page.keyboard.down('w');
  await expect.poll(async () => (await readAudioState(page)).thrustActive).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await readAudioState(page)).ambientActive).toBe(false);
  await expect.poll(async () => (await readAudioState(page)).thrustActive).toBe(false);
  await page.keyboard.up('w');
});

test('laser and asteroid breakup cues fire, but the score stinger only fires on thresholds', async ({
  page,
}) => {
  await launchWithButton(page);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.freezeSpawns();
    window.__ASTEROIDS_TEST_API__?.clearEntities();
    window.__ASTEROIDS_TEST_API__?.setShipState({
      fireCooldownMs: 0,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    });
  });

  const beforeLaser = await readAudioState(page);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await readAudioState(page)).cueCounts.laser).toBe(
    beforeLaser.cueCounts.laser + 1,
  );

  const beforeBreakup = await readAudioState(page);
  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.queueProjectileHit(1);
  });
  await expect.poll(async () => (await readAudioState(page)).cueCounts.asteroidBreakup).toBe(
    beforeBreakup.cueCounts.asteroidBreakup + 1,
  );

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.clearEntities();
    window.__ASTEROIDS_TEST_API__?.setScoreState({
      lives: 3,
      nextLifeScore: 100,
      score: 98,
    });
    window.__ASTEROIDS_TEST_API__?.queueProjectileHit(1);
  });

  const belowThreshold = await readAudioState(page);
  await expect.poll(async () => (await readSnapshot(page)).score).toBe(99);
  expect((await readAudioState(page)).cueCounts.scoreStinger).toBe(
    belowThreshold.cueCounts.scoreStinger,
  );

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.clearEntities();
    window.__ASTEROIDS_TEST_API__?.setScoreState({
      lives: 2,
      nextLifeScore: 100,
      score: 99,
    });
    window.__ASTEROIDS_TEST_API__?.queueProjectileHit(1);
  });

  await expect.poll(async () => (await readSnapshot(page)).score).toBe(100);
  await expect.poll(async () => (await readAudioState(page)).cueCounts.scoreStinger).toBe(
    belowThreshold.cueCounts.scoreStinger + 1,
  );
});

test('moves with thrust and turning inputs from keyboard controls', async ({ page }) => {
  await launchWithButton(page);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.freezeSpawns();
    window.__ASTEROIDS_TEST_API__?.clearEntities();
    window.__ASTEROIDS_TEST_API__?.setShipState({
      angle: -Math.PI / 2,
      angularVelocity: 0,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    });
  });

  await page.keyboard.down('w');
  await expect
    .poll(async () => magnitude((await readSnapshot(page)).ship.velocity))
    .toBeGreaterThan(5);
  await page.keyboard.up('w');

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.setShipState({
      angle: -Math.PI / 2,
      angularVelocity: 0,
      velocity: { x: 0, y: 0 },
    });
  });

  const initialAngle = -Math.PI / 2;
  await page.keyboard.down('a');
  await expect.poll(async () => (await readSnapshot(page)).ship.angle).toBeLessThan(
    initialAngle - 0.02,
  );
  await page.keyboard.up('a');

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.setShipState({
      angle: -Math.PI / 2,
      angularVelocity: 0,
      velocity: { x: 0, y: 0 },
    });
  });

  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await readSnapshot(page)).ship.angle).toBeGreaterThan(
    initialAngle + 0.02,
  );
  await page.keyboard.up('ArrowRight');
});

test('loses one life on impact, resets to centre, and ignores immediate follow-up hits', async ({
  page,
}) => {
  await launchWithButton(page);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.freezeSpawns();
    window.__ASTEROIDS_TEST_API__?.clearEntities();
    window.__ASTEROIDS_TEST_API__?.setShipState({
      damageCooldownMs: 0,
      lives: 3,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    });
    window.__ASTEROIDS_TEST_API__?.queueShipCollision();
  });

  await expect.poll(async () => (await readSnapshot(page)).ship.lives).toBe(2);

  const postHit = await readSnapshot(page);

  expect(postHit.ship.position.x).toBeCloseTo(0, 4);
  expect(postHit.ship.position.y).toBeCloseTo(0, 4);
  expect(postHit.ship.damageCooldownMs).toBeGreaterThan(0);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.queueShipCollision();
  });

  await page.waitForTimeout(150);

  expect((await readSnapshot(page)).ship.lives).toBe(2);
});

test('awards a bonus life every 100 points, caps lives at 3, and speeds up the fire rate', async ({
  page,
}) => {
  await launchWithButton(page);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.freezeSpawns();
    window.__ASTEROIDS_TEST_API__?.clearEntities();
    window.__ASTEROIDS_TEST_API__?.setScoreState({
      lives: 2,
      nextLifeScore: 100,
      score: 99,
    });
    window.__ASTEROIDS_TEST_API__?.setShipState({ fireCooldownMs: 0 });
    window.__ASTEROIDS_TEST_API__?.queueProjectileHit(1);
  });

  await expect.poll(async () => (await readSnapshot(page)).score).toBe(100);

  const firstThreshold = await readSnapshot(page);

  expect(firstThreshold.ship.lives).toBe(3);

  const firstProjectileCount = firstThreshold.projectiles.length;
  await page.keyboard.press('Space');
  await expect
    .poll(async () => (await readSnapshot(page)).projectiles.length)
    .toBeGreaterThan(firstProjectileCount);

  const after100 = await readSnapshot(page);

  expect(after100.ship.fireCooldownMs).toBeLessThanOrEqual(280);
  expect(after100.ship.fireCooldownMs).toBeGreaterThanOrEqual(220);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.clearEntities();
    window.__ASTEROIDS_TEST_API__?.setScoreState({
      lives: 3,
      nextLifeScore: 200,
      score: 199,
    });
    window.__ASTEROIDS_TEST_API__?.setShipState({ fireCooldownMs: 0 });
    window.__ASTEROIDS_TEST_API__?.queueProjectileHit(1);
  });

  await expect.poll(async () => (await readSnapshot(page)).score).toBe(200);

  const secondThreshold = await readSnapshot(page);

  expect(secondThreshold.ship.lives).toBe(3);

  const secondProjectileCount = secondThreshold.projectiles.length;
  await page.keyboard.press('Space');
  await expect
    .poll(async () => (await readSnapshot(page)).projectiles.length)
    .toBeGreaterThan(secondProjectileCount);

  const after200 = await readSnapshot(page);

  expect(after200.ship.fireCooldownMs).toBeLessThanOrEqual(260);
  expect(after200.ship.fireCooldownMs).toBeGreaterThanOrEqual(200);
});

test('ends the run after three ship collisions without extra lives', async ({ page }) => {
  await launchWithButton(page);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.freezeSpawns();
    window.__ASTEROIDS_TEST_API__?.clearEntities();
    window.__ASTEROIDS_TEST_API__?.setScoreState({
      lives: 3,
      nextLifeScore: 100,
      score: 0,
    });
    window.__ASTEROIDS_TEST_API__?.setShipState({
      alive: true,
      damageCooldownMs: 0,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    });
  });

  await collideShip(page, 2);
  await collideShip(page, 1);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.setShipState({ damageCooldownMs: 0 });
    window.__ASTEROIDS_TEST_API__?.queueShipCollision();
  });

  await expect.poll(() => readMode(page)).toBe('gameover');

  const snapshot = await readSnapshot(page);

  expect(snapshot.ship.alive).toBe(false);
  expect(snapshot.explosions.some((explosion) => explosion.type === 'ship')).toBe(true);
});

test('shows the leaderboard submission UI after game over', async ({ page }) => {
  await forceGameOver(page);

  await expect
    .poll(async () => (await readUiState(page)).overlayVisible)
    .toBe(true);

  const uiState = await readUiState(page);

  expect(uiState.overlayTitle).toBe('Signal Lost');
  expect(uiState.leaderboardFormVisible).toBe(true);
  await expect(page.locator('#leaderboard-initials')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Score' })).toBeVisible();
});

test('relaunch resets the run back to a clean starting state', async ({ page }) => {
  await forceGameOver(page, { score: 42 });

  await page.getByRole('button', { name: 'Relaunch' }).click();

  await expect.poll(() => readMode(page)).toBe('playing');

  const snapshot = await readSnapshot(page);
  const uiState = await readUiState(page);

  expect(snapshot.score).toBe(0);
  expect(snapshot.ship.lives).toBe(3);
  expect(snapshot.ship.alive).toBe(true);
  expect(snapshot.ship.position.x).toBeCloseTo(0, 4);
  expect(snapshot.ship.position.y).toBeCloseTo(0, 4);
  expect(snapshot.projectiles).toHaveLength(0);
  expect(uiState.overlayVisible).toBe(false);
});

test('leaderboard form validates initials and locks after a successful single submission', async ({
  page,
}) => {
  await forceGameOver(page, { score: 88 });

  const input = page.locator('#leaderboard-initials');
  const submit = page.getByRole('button', { name: 'Submit Score' });
  const status = page.locator('#leaderboard-submit-state');

  await input.fill('a1');
  await submit.click();

  await expect.poll(() => input.evaluate((element) => element.validationMessage)).toContain(
    'Enter exactly 3 letters.',
  );

  await input.fill('b9s!');
  await expect(input).toHaveValue('BS');

  await input.fill('bsp');
  await submit.click();

  await expect(status).toHaveText('Score transmitted.');
  await expect(input).toBeDisabled();
  await expect(submit).toBeDisabled();
  await expect(page.locator('.leaderboard__item').first()).toContainText('BSP');
  await expect(page.locator('.leaderboard__item').first()).toContainText('0088');
});

test('leaderboard surfaces load retry and submit errors', async ({ page }) => {
  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.setLeaderboardFailure({ failLoad: true });
  });
  await page.evaluate(() => window.__ASTEROIDS_TEST_API__?.refreshLeaderboard());

  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page.locator('#leaderboard-empty')).toHaveText(
    'Leaderboard load failed. Check Supabase access.',
  );

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.setLeaderboardFailure({ failLoad: false });
    window.__ASTEROIDS_TEST_API__?.setLeaderboardEntries([{ initials: 'ACE', score: 12 }]);
  });
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('.leaderboard__item').first()).toContainText('ACE');
  await expect(page.locator('.leaderboard__item').first()).toContainText('0012');

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.setLeaderboardFailure({ failSubmit: true });
  });
  await forceGameOver(page, { score: 64 });

  await page.locator('#leaderboard-initials').fill('err');
  await page.getByRole('button', { name: 'Submit Score' }).click();
  await expect(page.locator('#leaderboard-submit-state')).toHaveText(
    'Score submission failed. Check Supabase access.',
  );
});

test('pauses and resumes with Escape', async ({ page }) => {
  await launchWithButton(page);

  const beforePause = await readSnapshot(page);

  await page.keyboard.press('Escape');

  await expect
    .poll(async () => (await readUiState(page)).pauseButtonState)
    .toBe('paused');

  const pausedAt = await readSnapshot(page);

  await page.waitForTimeout(200);

  const stillPaused = await readSnapshot(page);

  expect(stillPaused.elapsedMs).toBe(pausedAt.elapsedMs);
  expect(stillPaused.elapsedMs).toBeGreaterThanOrEqual(beforePause.elapsedMs);

  await page.keyboard.press('Escape');

  await expect
    .poll(async () => (await readUiState(page)).pauseButtonState)
    .toBe('playing');

  await expect.poll(async () => (await readSnapshot(page)).elapsedMs).toBeGreaterThan(
    stillPaused.elapsedMs,
  );
});

test('pauses on window blur and resumes on focus without dropping back to the menu', async ({
  page,
}) => {
  await launchWithButton(page);

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect
    .poll(async () => (await readUiState(page)).overlayTitle)
    .toBe('Stand By');
  await expect.poll(async () => (await readAudioState(page)).ambientActive).toBe(false);

  const paused = await readSnapshot(page);
  await page.waitForTimeout(200);
  expect((await readSnapshot(page)).elapsedMs).toBe(paused.elapsedMs);

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(async () => (await readAudioState(page)).ambientActive).toBe(true);
  await expect.poll(async () => (await readSnapshot(page)).elapsedMs).toBeGreaterThan(
    paused.elapsedMs,
  );
  expect(await readMode(page)).toBe('playing');
});

test('mobile drag input can aim and fire after launch', async ({ page }) => {
  await launchWithButton(page);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.freezeSpawns();
    window.__ASTEROIDS_TEST_API__?.clearEntities();
    window.__ASTEROIDS_TEST_API__?.setShipState({
      angle: -Math.PI / 2,
      fireCooldownMs: 0,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    });
  });

  const snapshot = await readSnapshot(page);
  const targetX = snapshot.viewport.width / 2 + 180;
  const targetY = snapshot.viewport.height / 2;

  await page.evaluate(
    ({ x, y }) => {
      window.__ASTEROIDS_TEST_API__?.setDragInput({ active: true, x, y });
    },
    { x: targetX, y: targetY },
  );

  await expect.poll(async () => (await readSnapshot(page)).ship.angle).toBeGreaterThan(-0.15);
  await expect
    .poll(async () => (await readSnapshot(page)).projectiles.length)
    .toBeGreaterThan(0);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.setDragInput({ active: false });
    window.__ASTEROIDS_TEST_API__?.clearInput();
  });
});

test('does not deduct another life while collisions keep happening during invulnerability', async ({
  page,
}) => {
  await launchWithButton(page);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.freezeSpawns();
    window.__ASTEROIDS_TEST_API__?.clearEntities();
    window.__ASTEROIDS_TEST_API__?.setShipState({
      damageCooldownMs: 0,
      lives: 3,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    });
    window.__ASTEROIDS_TEST_API__?.queueShipCollision();
  });

  await expect.poll(async () => (await readSnapshot(page)).ship.lives).toBe(2);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.evaluate(() => {
      window.__ASTEROIDS_TEST_API__?.queueShipCollision();
    });
    await page.waitForTimeout(120);
  }

  const protectedSnapshot = await readSnapshot(page);

  expect(protectedSnapshot.ship.lives).toBe(2);
  expect(protectedSnapshot.ship.damageCooldownMs).toBeGreaterThan(0);
});

test('keeps life rewards capped at three on exact 100, 200, and 300 point thresholds', async ({
  page,
}) => {
  await launchWithButton(page);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.freezeSpawns();
    window.__ASTEROIDS_TEST_API__?.clearEntities();
  });

  for (const threshold of [100, 200, 300]) {
    await page.evaluate((targetThreshold) => {
      window.__ASTEROIDS_TEST_API__?.setScoreState({
        lives: 3,
        nextLifeScore: targetThreshold,
        score: targetThreshold - 1,
      });
      window.__ASTEROIDS_TEST_API__?.queueProjectileHit(1);
    }, threshold);
    await expect.poll(async () => (await readSnapshot(page)).score).toBe(threshold);

    const snapshot = await readSnapshot(page);

    expect(snapshot.ship.lives).toBe(3);
  }
});

test('gameplay difficulty ramps from score progression instead of elapsed time', async ({
  page,
}) => {
  await launchWithButton(page);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.freezeSpawns();
    window.__ASTEROIDS_TEST_API__?.clearEntities();
    window.__ASTEROIDS_TEST_API__?.setElapsedMs(180_000);
    window.__ASTEROIDS_TEST_API__?.setScoreState({
      score: 0,
    });
  });

  await expect.poll(async () => (await readSnapshot(page)).spawnIntensity).toBe(0);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.setScoreState({
      score: 100,
    });
  });

  await expect.poll(async () => (await readSnapshot(page)).spawnIntensity).toBe(0.5);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.setScoreState({
      score: 200,
    });
  });

  await expect.poll(async () => (await readSnapshot(page)).spawnIntensity).toBe(1);
});

test('ship hit and final ship destruction trigger different explosion cues', async ({
  page,
}) => {
  await launchWithButton(page);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.freezeSpawns();
    window.__ASTEROIDS_TEST_API__?.clearEntities();
    window.__ASTEROIDS_TEST_API__?.setScoreState({
      lives: 2,
      nextLifeScore: 100,
      score: 0,
    });
    window.__ASTEROIDS_TEST_API__?.setShipState({
      alive: true,
      damageCooldownMs: 0,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    });
  });

  const beforeHit = await readAudioState(page);
  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.queueShipCollision();
  });
  await expect.poll(async () => (await readSnapshot(page)).ship.lives).toBe(1);
  await expect.poll(async () => (await readAudioState(page)).cueCounts.shipHit).toBe(
    beforeHit.cueCounts.shipHit + 1,
  );
  expect((await readAudioState(page)).cueCounts.shipDestroyed).toBe(
    beforeHit.cueCounts.shipDestroyed,
  );

  const beforeDestroyed = await readAudioState(page);
  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.setShipState({ damageCooldownMs: 0 });
    window.__ASTEROIDS_TEST_API__?.queueShipCollision();
  });
  await expect.poll(() => readMode(page)).toBe('gameover');
  await expect.poll(async () => (await readAudioState(page)).cueCounts.shipDestroyed).toBe(
    beforeDestroyed.cueCounts.shipDestroyed + 1,
  );
});

test('mute silences active audio layers and persists after reload', async ({ page }) => {
  await launchWithButton(page);
  await expect.poll(async () => (await readAudioState(page)).ambientActive).toBe(true);

  const muteButton = page.getByRole('button', { name: 'Mute audio' });
  await muteButton.click();

  await expect.poll(async () => (await readAudioState(page)).muted).toBe(true);
  await expect.poll(async () => (await readAudioState(page)).ambientActive).toBe(false);

  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.freezeSpawns();
    window.__ASTEROIDS_TEST_API__?.clearEntities();
    window.__ASTEROIDS_TEST_API__?.setShipState({ fireCooldownMs: 0 });
  });

  const mutedCounts = await readAudioState(page);
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  expect((await readAudioState(page)).cueCounts.laser).toBe(mutedCounts.cueCounts.laser);

  await openGame(page, true);
  expect((await readAudioState(page)).muted).toBe(true);
  await expect(page.getByRole('button', { name: 'Unmute audio' })).toBeVisible();
});

async function launchWithButton(page: Page) {
  await page.getByRole('button', { name: 'Tap to launch' }).click();
  await expect.poll(() => readMode(page)).toBe('playing');
}

async function openGame(page: Page, reload = false) {
  if (reload) {
    await page.reload();
  } else {
    await page.goto('/');
  }

  await page.locator('#game-canvas canvas').waitFor({ state: 'visible' });
  await expect
    .poll(() => page.evaluate(() => window.__ASTEROIDS_TEST_API__?.isReady() ?? false))
    .toBe(true);
}

async function forceGameOver(
  page: Page,
  { score = 0 }: { score?: number } = {},
) {
  await launchWithButton(page);

  await page.evaluate((targetScore) => {
    window.__ASTEROIDS_TEST_API__?.freezeSpawns();
    window.__ASTEROIDS_TEST_API__?.clearEntities();
    window.__ASTEROIDS_TEST_API__?.setScoreState({
      lives: 1,
      nextLifeScore: 100,
      score: targetScore,
    });
    window.__ASTEROIDS_TEST_API__?.setShipState({
      alive: true,
      damageCooldownMs: 0,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    });
    window.__ASTEROIDS_TEST_API__?.queueShipCollision();
  }, score);

  await expect.poll(() => readMode(page)).toBe('gameover');
  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.setGameOverOverlayDelay(0);
  });
  await expect
    .poll(async () => (await readUiState(page)).overlayVisible)
    .toBe(true);
}

async function collideShip(page: Page, expectedLives: number) {
  await page.evaluate(() => {
    window.__ASTEROIDS_TEST_API__?.setShipState({ damageCooldownMs: 0 });
    window.__ASTEROIDS_TEST_API__?.queueShipCollision();
  });

  await expect.poll(async () => (await readSnapshot(page)).ship.lives).toBe(expectedLives);
}

async function readMode(page: Page) {
  return page.evaluate(() => window.__ASTEROIDS_TEST_API__?.getSnapshot().mode ?? 'missing');
}

async function readSnapshot(page: Page) {
  return page.evaluate(() => window.__ASTEROIDS_TEST_API__!.getSnapshot());
}

async function readUiState(page: Page) {
  return page.evaluate(() => window.__ASTEROIDS_TEST_API__!.getUiState());
}

async function readAudioState(page: Page) {
  return page.evaluate(() => window.__ASTEROIDS_TEST_API__!.getAudioState());
}

function magnitude(vector: { x: number; y: number }) {
  return Math.hypot(vector.x, vector.y);
}
