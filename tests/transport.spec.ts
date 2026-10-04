import { test, expect } from '@playwright/test';

test('transportkaart laadt voorbeelddata en telt kilometers op', async ({ page }) => {
  // Geen externe diensten in tests: kaarttegels en routering blokkeren, zodat de schatting wordt gebruikt.
  await page.route(/^https?:\/\/(?!localhost)/, route => route.abort());
  await page.goto('/transport.html');
  await page.locator('#use-routing').uncheck();
  await page.locator('#load-example').click();
  await expect(page.locator('#stats')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#kpi-trips')).toHaveText('5.123');
  await expect(page.locator('#mode-table tr')).toHaveCount(3);
  await expect(page.locator('#mode-table')).toContainText('68 vaarten');
  await expect(page.locator('#ov-modes')).toBeVisible();

  await page.locator('#scrub').evaluate((el: HTMLInputElement) => {
    el.value = el.max;
    el.dispatchEvent(new Event('input'));
  });
  await expect(page.locator('#ov-date')).toHaveText('29-08-2025');
  const km = await page.locator('#ov-km').textContent();
  expect(Number(km!.replace(/[^\d]/g, ''))).toBeGreaterThan(100000);
});

test('CSV met komma, DD-MM-JJJJ en plaatsnamen zonder coördinaten', async ({ page }) => {
  await page.goto('/transport.html');
  const result = await page.evaluate(() => {
    const t = (window as any).SmartTbiTransport;
    return t.rowsToTrips(t.parseCsv('Datum,Herkomst\n01-04-2025,"Nieuwegein"\n02-04-2025,Amersfoort\nfout,Zwolle\n'));
  });
  expect(result.trips.length).toBe(2);
  expect(result.skipped).toBe(1);
  expect(result.trips[0].origin).toBe('Nieuwegein');
});

test('modaliteit en vaarwegennetwerk', async ({ page }) => {
  await page.goto('/transport.html');
  const result = await page.evaluate(() => {
    const t = (window as any).SmartTbiTransport;
    const parsed = t.rowsToTrips(t.parseCsv('datum;herkomst;modaliteit\n2025-04-01;Nijmegen;Schip\n2025-04-01;Amsterdam;trein\n2025-04-01;Tiel;\n2025-04-01;Tiel;raket\n'));
    return { modes: parsed.trips.map((x: any) => x.mode), skipped: parsed.skipped, water: t.waterPath('waalhaven', 'lageWeide') };
  });
  expect(result.modes).toEqual(['water', 'ov', 'road']);
  expect(result.skipped).toBe(1);
  expect(result.water.km).toBeGreaterThan(70);
  expect(result.water.km).toBeLessThan(130);
});

test('CO2-scenario verschuift wegritten naar water', async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, route => route.abort());
  await page.goto('/transport.html');
  await page.locator('#use-routing').uncheck();
  await page.locator('#load-example').click();
  await expect(page.locator('#co2')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#scn-vehicles input[value="betonmixer"]')).not.toBeChecked();
  await expect(page.locator('#scn-summary')).toContainText('CO₂ daalt');
  await expect(page.locator('#scn-lanes tr').first()).toBeVisible();
  await page.locator('#scrub').evaluate((el: HTMLInputElement) => {
    el.value = el.max;
    el.dispatchEvent(new Event('input'));
  });
  await expect(page.locator('#ov-co2')).not.toHaveText('0 t');

  // Geen ladingen bundelen en geen kade in de buurt: niets verschuift.
  await page.locator('#scn-quay').fill('0');
  await expect(page.locator('#scn-summary')).toContainText('geen ritten verschoven');
});
