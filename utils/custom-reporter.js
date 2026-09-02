import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

/**
 * Custom reporter: run summary, failure analysis, healing hints, and the
 * post-run results email sent through Outlook.
 */
export default class CustomReporter {
  constructor() {
    // Keyed by test id so each test case is counted ONCE, no matter how many
    // attempts it made. Counting raw attempts produced totals larger than the
    // number of test cases (e.g. 23 passed + 3 failed out of 24).
    this.byTest = new Map();
    this.startTime = Date.now();
  }

  onBegin(config, suite) {
    this.totalTests = suite.allTests().length;
    console.log('\n========================================');
    console.log('  SkyCommand Test Run');
    console.log('========================================');
    console.log(`  Tests: ${this.totalTests}`);
    console.log(`  Target: ${process.env.BASE_URL || 'default'}\n`);
  }

  onTestEnd(test, result) {
    // Later attempts overwrite earlier ones, so the map holds the final
    // outcome of each test case.
    this.byTest.set(test.id, {
      title: test.title,
      file: test.location ? path.basename(test.location.file) : 'unknown',
      status: result.status,
      duration: result.duration,
      retry: result.retry,
      error: result.error ? String(result.error.message || '').slice(0, 800) : null,
    });
  }

  async onEnd(result) {
    this.results = [...this.byTest.values()];

    const passed = this.results.filter((r) => r.status === 'passed').length;
    const failed = this.results.filter((r) => r.status === 'failed').length;
    const skipped = this.results.filter((r) => r.status === 'skipped').length;
    const flaky = this.results.filter((r) => r.status === 'passed' && r.retry > 0).length;
    const total = this.results.length;
    const passRate = total ? ((passed / total) * 100).toFixed(1) : '0.0';
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);

    console.log('\n========================================');
    console.log('  Summary');
    console.log('========================================');
    console.log(`  Test cases:  ${this.totalTests ?? total}`);
    console.log(`  Executed:    ${total}`);
    console.log(`  Passed:      ${passed}`);
    console.log(`  Failed:      ${failed}`);
    console.log(`  Skipped:     ${skipped}`);
    console.log(`  Pass rate:   ${passRate}%`);
    console.log(`  Duration:    ${duration}s`);
    console.log(`  Status:      ${result.status}`);

    if (failed > 0) {
      console.log('\n  Failed test cases:');
      this.results
        .filter((r) => r.status === 'failed')
        .forEach((r) => console.log(`    - ${r.title.replace(/ @[\w@ ]+$/, '')}`));
    }

    const healingCandidates = this.results
      .filter((r) => r.status === 'failed' && r.error && this.isSelectorError(r.error))
      .map((r) => ({ test: r.title, file: r.file, error: r.error }));

    if (healingCandidates.length) {
      console.log(`\n  ${healingCandidates.length} failure(s) look selector-related.`);
      console.log('  Run: npm run heal:tests');
    }

    const reportDir = path.join(process.cwd(), 'reports');
    fs.mkdirSync(reportDir, { recursive: true });

    fs.writeFileSync(
      path.join(reportDir, 'custom-report.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          baseUrl: process.env.BASE_URL || null,
          // 'interrupted' means the run was stopped part-way (e.g. Ctrl+C).
          interrupted: result.status === 'interrupted',
          summary: { testCases: this.totalTests ?? total, total, passed, failed, skipped, flaky, passRate, duration },
          results: this.results,
        },
        null,
        2
      )
    );

    fs.writeFileSync(
      path.join(reportDir, 'healing-recommendations.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), healingCandidates }, null, 2)
    );

    console.log('\n  HTML report: npm run report\n');

    this.sendResultsEmail();
  }

  /**
   * Email the summary through the Outlook desktop app.
   *
   * Runs synchronously so it completes before Playwright exits, and never
   * throws - a mail problem must not change the outcome of a test run.
   * Disable with NOTIFY_EMAIL=false.
   */
  sendResultsEmail() {
    if (process.env.NOTIFY_EMAIL === 'false') {
      console.log('  Email notification disabled (NOTIFY_EMAIL=false).\n');
      return;
    }

    const script = path.join(process.cwd(), 'scripts', 'send-report-email.ps1');
    if (!fs.existsSync(script)) return;

    const recipient = process.env.NOTIFY_EMAIL_TO || 'umeshgouda.hiregoudra@skypoint.ai';

    try {
      const proc = spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy', 'Bypass',
          '-File', script,
          '-To', recipient,
        ],
        {
          encoding: 'utf-8',
          timeout: 90000,
          // Pass SMTP credentials through from .env (loaded by playwright.config).
          env: { ...process.env },
        }
      );

      const output = `${proc.stdout || ''}${proc.stderr || ''}`.trim();
      if (output) console.log(output);
    } catch (err) {
      console.log(`  Could not send the results email: ${err.message}`);
    }
  }

  isSelectorError(message) {
    const patterns = [
      'locator',
      'selector',
      'strict mode violation',
      'waiting for',
      'element is not visible',
      'no element matches',
    ];
    const lower = message.toLowerCase();
    return patterns.some((p) => lower.includes(p));
  }
}
