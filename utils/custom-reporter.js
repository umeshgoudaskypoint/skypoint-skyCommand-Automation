import fs from 'fs';
import path from 'path';

/**
 * Custom reporter: run summary, failure analysis and healing hints.
 */
export default class CustomReporter {
  constructor() {
    this.results = [];
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
    this.results.push({
      title: test.title,
      file: test.location ? path.basename(test.location.file) : 'unknown',
      status: result.status,
      duration: result.duration,
      retry: result.retry,
      error: result.error ? String(result.error.message || '').slice(0, 800) : null,
    });
  }

  async onEnd(result) {
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
    console.log(`  Passed:   ${passed}`);
    console.log(`  Failed:   ${failed}`);
    console.log(`  Skipped:  ${skipped}`);
    console.log(`  Flaky:    ${flaky}`);
    console.log(`  Pass rate: ${passRate}%`);
    console.log(`  Duration:  ${duration}s`);
    console.log(`  Status:    ${result.status}`);

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
          summary: { total, passed, failed, skipped, flaky, passRate, duration },
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
