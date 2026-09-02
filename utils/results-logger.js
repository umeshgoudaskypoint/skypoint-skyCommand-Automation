import fs from 'fs';
import path from 'path';

/**
 * Results logger.
 *
 * Appends every test case to a dated results file AS IT FINISHES, so the log
 * survives a run that is stopped part-way.
 *
 *   - Passed tests: one line, no detail.
 *   - Failed tests: a full block with everything needed to raise a bug -
 *     the error, where it happened in the code, and a repro command.
 *     Text only: no screenshots, videos or traces.
 *
 * Output: reports/test-results-YYYY-MM-DD.md
 */
export default class ResultsLogger {
  constructor() {
    this.startTime = Date.now();
    this.byTest = new Map();

    const now = new Date();
    this.dateStamp = now.toISOString().slice(0, 10);
    this.reportDir = path.join(process.cwd(), 'reports');
    this.logFile = path.join(this.reportDir, `test-results-${this.dateStamp}.md`);
    this.failuresWritten = 0;
  }

  /** "TC-PI-005" out of "TC-PI-005: community dropdown ... @sanity". */
  testNumber(title) {
    const match = title.match(/\b(TC-[A-Z]+-\d+[a-z]?)\b/);
    return match ? match[1] : '-';
  }

  /** Title without the ID prefix and the @tags suffix. */
  cleanTitle(title) {
    return title
      .replace(/^\s*TC-[A-Z]+-\d+[a-z]?:\s*/, '')
      .replace(/\s*@[\w@ ]+$/, '')
      .trim();
  }

  timestamp(date = new Date()) {
    return date.toTimeString().slice(0, 8);
  }

  append(text) {
    fs.appendFileSync(this.logFile, text, 'utf-8');
  }

  onBegin(config, suite) {
    fs.mkdirSync(this.reportDir, { recursive: true });
    this.totalTests = suite.allTests().length;

    const started = new Date();
    const header = [
      ``,
      `# Test Run - ${this.dateStamp} ${this.timestamp(started)}`,
      ``,
      `- Date: ${started.toDateString()}`,
      `- Started: ${started.toLocaleTimeString()}`,
      `- Target: ${process.env.BASE_URL || 'default'}`,
      `- Tenant: ${process.env.TENANT || 'default'}`,
      `- Test cases: ${this.totalTests}`,
      ``,
      `## Results`,
      ``,
      `| Test | Status | Duration | Finished |`,
      `|---|---|---|---|`,
      ``,
    ].join('\n');

    this.append(header);
  }

  onTestEnd(test, result) {
    const number = this.testNumber(test.title);
    this.byTest.set(test.id, { test, result, number });

    const duration = (result.duration / 1000).toFixed(1);
    const status =
      result.status === 'passed'
        ? 'PASSED'
        : result.status === 'skipped'
          ? 'SKIPPED'
          : 'FAILED';

    // One row per test case, written immediately.
    this.append(
      `| ${number} | ${status} | ${duration}s | ${this.timestamp()} |\n`
    );
  }

  /** Everything a developer needs to reproduce and raise a bug. */
  buildFailureBlock(entry, index) {
    const { test, result, number } = entry;

    const location = test.location
      ? `${path.relative(process.cwd(), test.location.file).replace(/\\/g, '/')}:${test.location.line}`
      : 'unknown';

    const error = result.error || {};
    const message = String(error.message || 'No error message captured')
      .replace(/\[[0-9;]*m/g, '')
      .trim();

    const stack = String(error.stack || '')
      .replace(/\[[0-9;]*m/g, '')
      .split('\n')
      .filter((l) => l.includes('.ts:') || l.includes('.js:'))
      .slice(0, 6)
      .map((l) => l.trim())
      .join('\n');

    // Screenshot / video captured on failure only - attach them to the bug.
    const attachments = (result.attachments || [])
      .filter((a) => a.path)
      .map(
        (a) => `- ${a.name}: \`${path.relative(process.cwd(), a.path).replace(/\\/g, '/')}\``
      )
      .join('\n');

    const lines = [
      ``,
      `### ${index}. ${number} - ${this.cleanTitle(test.title)}`,
      ``,
      `| | |`,
      `|---|---|`,
      `| Test case | ${number} |`,
      `| Suite | ${test.parent && test.parent.title ? test.parent.title : '-'} |`,
      `| Location | \`${location}\` |`,
      `| Duration | ${(result.duration / 1000).toFixed(1)}s |`,
      `| Failed at | ${this.dateStamp} ${this.timestamp(new Date())} |`,
      `| Environment | ${process.env.BASE_URL || 'default'} |`,
      `| Tenant | ${process.env.TENANT || 'default'} |`,
      ``,
      `**What went wrong**`,
      ``,
      '```',
      message.slice(0, 1500),
      '```',
      ``,
    ];

    if (stack) {
      lines.push(`**Where in the code**`, ``, '```', stack, '```', ``);
    }

    if (attachments) {
      lines.push(`**Evidence** (failures only)`, ``, attachments, ``);
    }

    lines.push(
      `**To reproduce**`,
      ``,
      '```bash',
      `npx playwright test ${location.split(':')[0]} --grep "${number}" --headed`,
      '```',
      ``,
      `---`,
      ``
    );

    return lines.join('\n');
  }

  async onEnd(result) {
    const entries = [...this.byTest.values()];

    const passed = entries.filter((e) => e.result.status === 'passed');
    const failed = entries.filter((e) => e.result.status === 'failed');
    const skipped = entries.filter((e) => e.result.status === 'skipped');

    const executed = entries.length;
    const passRate = executed ? ((passed.length / executed) * 100).toFixed(1) : '0.0';
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const interrupted = result.status === 'interrupted';

    const summary = [
      ``,
      `## Summary`,
      ``,
      `| | |`,
      `|---|---|`,
      `| Date | ${new Date().toDateString()} |`,
      `| Finished | ${new Date().toLocaleTimeString()} |`,
      `| Test cases | ${this.totalTests ?? executed} |`,
      `| Executed | ${executed} |`,
      `| **Passed** | **${passed.length}** |`,
      `| **Failed** | **${failed.length}** |`,
      `| Skipped | ${skipped.length} |`,
      `| Pass rate | ${passRate}% |`,
      `| Duration | ${duration}s |`,
      `| Run status | ${interrupted ? 'STOPPED PART-WAY' : result.status.toUpperCase()} |`,
      ``,
    ];

    if (interrupted) {
      summary.push(
        `> This run was stopped before all tests completed. The numbers above`,
        `> cover only the tests that actually ran.`,
        ``
      );
    }

    const passedList = passed.map((e) => e.number).sort().join(', ');
    const failedList = failed.map((e) => e.number).sort().join(', ');

    summary.push(
      `**Passed (${passed.length}):** ${passedList || 'none'}`,
      ``,
      `**Failed (${failed.length}):** ${failedList || 'none'}`,
      ``
    );

    this.append(summary.join('\n'));

    if (failed.length > 0) {
      this.append(`\n## Failure details\n\nOne block per failed test case, with everything needed to raise a bug.\n`);
      failed.forEach((entry, i) => {
        this.append(this.buildFailureBlock(entry, i + 1));
      });
    }

    this.append(`\n${'='.repeat(60)}\n`);

    console.log(`\n  Results log: reports/test-results-${this.dateStamp}.md`);
    if (failed.length > 0) {
      console.log(`  ${failed.length} failure(s) documented with full detail for bug reports.`);
    }
  }
}
