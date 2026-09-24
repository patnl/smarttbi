import { test, expect } from '@playwright/test';

test('transportkaart laadt voorbeelddata en telt kilometers op', async ({ page }) => {
  // Geen externe diensten in tests: kaarttegels en routering blokkeren, zodat de schatting wordt gebruikt.
  await page.route(/^https?:\/\/(?!localhost)/, route => route.abort());
  await page.goto('/transport.html');
  await page.locator('#use-routing').uncheck();
  await page.locator('#load-example').click();
  await expect(page.locator('#stats')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#kpi-trips')).toHaveText('2.466');

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
