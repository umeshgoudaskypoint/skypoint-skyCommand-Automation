import { Page, Locator, expect, FrameLocator } from '@playwright/test';

/**
 * BasePage - common functionality shared by every page object.
 */
export class BasePage {
  readonly page: Page;
  protected defaultTimeout: number;

  constructor(page: Page) {
    this.page = page;
    this.defaultTimeout = Number(process.env.DEFAULT_TIMEOUT) || 30000;
  }

  // ---------- Navigation ----------
  async navigate(path: string = '/'): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  async navigateAndWait(path: string = '/'): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await this.waitForNetworkIdle();
  }

  getCurrentUrl(): string {
    return this.page.url();
  }

  async waitForUrl(pattern: string | RegExp, timeout?: number): Promise<void> {
    await this.page.waitForURL(pattern, { timeout: timeout ?? this.defaultTimeout });
  }

  async goBack(): Promise<void> {
    await this.page.goBack({ waitUntil: 'domcontentloaded' });
  }

  async refresh(): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }

  // ---------- Element interactions ----------
  async waitForElement(selector: string, timeout?: number): Promise<Locator> {
    const locator = this.page.locator(selector).first();
    await locator.waitFor({ state: 'visible', timeout: timeout ?? this.defaultTimeout });
    return locator;
  }

  async waitForElementHidden(selector: string, timeout?: number): Promise<void> {
    await this.page
      .locator(selector)
      .first()
      .waitFor({ state: 'hidden', timeout: timeout ?? this.defaultTimeout });
  }

  async clickElement(selector: string, timeout?: number): Promise<void> {
    const el = await this.waitForElement(selector, timeout);
    await el.click();
  }

  async doubleClick(selector: string): Promise<void> {
    const el = await this.waitForElement(selector);
    await el.dblclick();
  }

  async rightClick(selector: string): Promise<void> {
    const el = await this.waitForElement(selector);
    await el.click({ button: 'right' });
  }

  async fillInput(selector: string, value: string): Promise<void> {
    const el = await this.waitForElement(selector);
    await el.fill(value);
  }

  async typeWithDelay(selector: string, text: string, delay = 100): Promise<void> {
    const el = await this.waitForElement(selector);
    await el.click();
    await el.pressSequentially(text, { delay });
  }

  async getText(selector: string): Promise<string> {
    const el = await this.waitForElement(selector);
    const text = await el.textContent();
    return text ? text.trim() : '';
  }

  async getValue(selector: string): Promise<string> {
    const el = await this.waitForElement(selector);
    return await el.inputValue();
  }

  async selectOption(selector: string, value: string): Promise<void> {
    const el = await this.waitForElement(selector);
    await el.selectOption(value);
  }

  async setCheckbox(selector: string, checked: boolean): Promise<void> {
    const el = await this.waitForElement(selector);
    if (checked) {
      await el.check();
    } else {
      await el.uncheck();
    }
  }

  async hover(selector: string): Promise<void> {
    const el = await this.waitForElement(selector);
    await el.hover();
  }

  async focus(selector: string): Promise<void> {
    const el = await this.waitForElement(selector);
    await el.focus();
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  // ---------- Element state ----------
  /** Returns a boolean instead of throwing - safe for conditional logic. */
  async isVisible(selector: string, timeout = 5000): Promise<boolean> {
    try {
      await this.page.locator(selector).first().waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  async exists(selector: string): Promise<boolean> {
    return (await this.page.locator(selector).count()) > 0;
  }

  async isEnabled(selector: string): Promise<boolean> {
    return await this.page.locator(selector).first().isEnabled();
  }

  async isChecked(selector: string): Promise<boolean> {
    return await this.page.locator(selector).first().isChecked();
  }

  async getCount(selector: string): Promise<number> {
    return await this.page.locator(selector).count();
  }

  async getAttribute(selector: string, attr: string): Promise<string | null> {
    return await this.page.locator(selector).first().getAttribute(attr);
  }

  // ---------- Scrolling ----------
  async scrollIntoView(selector: string): Promise<void> {
    await this.page.locator(selector).first().scrollIntoViewIfNeeded();
  }

  async scrollToTop(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, 0));
  }

  async scrollToBottom(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  // ---------- Waiting ----------
  async waitForNetworkIdle(timeout = 15000): Promise<void> {
    try {
      await this.page.waitForLoadState('networkidle', { timeout });
    } catch {
      // Analytics dashboards poll continuously - never fail a test on idle timeout.
    }
  }

  async waitForAPICall(urlPart: string, timeout?: number) {
    return await this.page.waitForResponse(
      (r) => r.url().includes(urlPart) && r.status() < 400,
      { timeout: timeout ?? this.defaultTimeout }
    );
  }

  async waitForStable(selector: string, timeout = 10000): Promise<void> {
    const el = this.page.locator(selector).first();
    const deadline = Date.now() + timeout;
    let previous = await el.boundingBox();
    while (Date.now() < deadline) {
      await this.page.waitForTimeout(200);
      const current = await el.boundingBox();
      if (previous && current && previous.x === current.x && previous.y === current.y) {
        return;
      }
      previous = current;
    }
  }

  async wait(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  // ---------- Screenshots ----------
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `reports/screenshots/${name}.png`, fullPage: true });
  }

  async takeElementScreenshot(selector: string, name: string): Promise<void> {
    await this.page
      .locator(selector)
      .first()
      .screenshot({ path: `reports/screenshots/${name}.png` });
  }

  // ---------- Dialogs & frames ----------
  async handleAlert(accept = true): Promise<void> {
    this.page.once('dialog', async (d) => {
      if (accept) {
        await d.accept();
      } else {
        await d.dismiss();
      }
    });
  }

  getFrameLocator(selector: string): FrameLocator {
    return this.page.frameLocator(selector);
  }

  // ---------- Tenant switching ----------
  /**
   * The tenant switcher lives in the user menu (the username in the app
   * header), so every page object inherits the ability to switch tenant.
   */
  protected readonly tenantSelectors = {
    userMenu:
      '[data-testid*="user-menu"], [class*="userMenu"], [class*="user-menu"], ' +
      '[class*="avatar"], [aria-label*="account" i], [aria-label*="profile" i]',
    tenantDropdown:
      '[data-testid*="tenant"], [class*="tenantSelect"], [class*="tenant-select"], ' +
      '[aria-label*="tenant" i], [class*="instanceSelect"]',
    tenantOption: '[role="option"], [role="menuitem"], [class*="option"], li',
  };

  /** Open the user menu in the app header. */
  async openUserMenu(): Promise<void> {
    await this.clickElement(this.tenantSelectors.userMenu);
    await this.page.waitForTimeout(1500);
  }

  /** Tenant names currently offered in the switcher. */
  async getAvailableTenants(): Promise<string[]> {
    await this.openUserMenu();

    if (await this.isVisible(this.tenantSelectors.tenantDropdown, 5000)) {
      await this.clickElement(this.tenantSelectors.tenantDropdown);
      await this.page.waitForTimeout(1000);
    }

    const options = await this.page
      .locator(this.tenantSelectors.tenantOption)
      .allTextContents();

    await this.pressKey('Escape');
    return options.map((t) => t.trim()).filter(Boolean);
  }

  /**
   * Switch to a named tenant via the user menu. No-op when that tenant is
   * already active. Matching is case-insensitive and partial, so "westmont"
   * also matches "Westmont Living".
   */
  async switchToTenant(tenantName: string): Promise<void> {
    if (await this.isTenantActive(tenantName)) return;

    await this.openUserMenu();

    if (await this.isVisible(this.tenantSelectors.tenantDropdown, 5000)) {
      await this.clickElement(this.tenantSelectors.tenantDropdown);
      await this.page.waitForTimeout(1000);
    }

    const option = this.page
      .locator(this.tenantSelectors.tenantOption)
      .filter({ hasText: new RegExp(tenantName, 'i') })
      .first();

    if (!(await option.isVisible({ timeout: 10000 }).catch(() => false))) {
      const available = await this.page
        .locator(this.tenantSelectors.tenantOption)
        .allTextContents();
      throw new Error(
        `Tenant "${tenantName}" not found in the switcher. Available: ` +
          (available.map((t) => t.trim()).filter(Boolean).join(', ') || '(none)')
      );
    }

    await option.click();
    await this.page.waitForTimeout(3000);
    await this.waitForNetworkIdle();
  }

  /** Is the named tenant the one currently shown in the header? */
  async isTenantActive(tenantName: string): Promise<boolean> {
    const header = await this.page
      .locator('header, [class*="header"], [class*="topBar"]')
      .first()
      .textContent()
      .catch(() => '');
    return new RegExp(tenantName, 'i').test(header || '');
  }

  // ---------- Storage ----------
  async clearSession(): Promise<void> {
    await this.page.context().clearCookies();
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  async setLocalStorage(key: string, value: string): Promise<void> {
    await this.page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value]);
  }

  async getLocalStorage(key: string): Promise<string | null> {
    return await this.page.evaluate((k) => localStorage.getItem(k), key);
  }

  // ---------- Assertions (fluent) ----------
  async assertVisible(selector: string): Promise<void> {
    await expect(this.page.locator(selector).first()).toBeVisible();
  }

  async assertHidden(selector: string): Promise<void> {
    await expect(this.page.locator(selector).first()).toBeHidden();
  }

  async assertContainsText(selector: string, text: string): Promise<void> {
    await expect(this.page.locator(selector).first()).toContainText(text);
  }

  async assertHasValue(selector: string, value: string): Promise<void> {
    await expect(this.page.locator(selector).first()).toHaveValue(value);
  }

  async assertCount(selector: string, count: number): Promise<void> {
    await expect(this.page.locator(selector)).toHaveCount(count);
  }

  async assertTitle(title: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(title);
  }

  async assertUrl(url: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(url);
  }
}
