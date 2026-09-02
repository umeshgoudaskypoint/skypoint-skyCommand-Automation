import { FullConfig } from "@playwright/test";

/** Runs once after the whole suite. Add API-based test-data cleanup here. */
async function globalTeardown(_config: FullConfig): Promise<void> {
  console.log("\n========================================");
  console.log("  SkyCommand Automation - Teardown");
  console.log("========================================");
  console.log("  Reports: automation/reports/html/index.html");
  console.log("  View with: npm run report\n");
}

export default globalTeardown;
