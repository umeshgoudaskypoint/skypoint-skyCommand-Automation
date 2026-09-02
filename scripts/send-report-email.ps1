# Send the test-run summary through the Outlook desktop app.
#
# Uses Outlook COM automation, so it sends from whichever account Outlook is
# already signed in as - no SMTP server, API key or stored password.
#
#   powershell -ExecutionPolicy Bypass -File scripts/send-report-email.ps1
#
# Reads reports/custom-report.json, written by utils/custom-reporter.js.

param(
    [string]$ReportPath = "reports/custom-report.json",
    [string]$To = "umeshgouda.hiregoudra@skypoint.ai",
    [string]$SubjectPrefix = "[skyCommand Automation]",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ReportPath)) {
    Write-Host "  No report found at $ReportPath - nothing to send."
    exit 0
}

$report = Get-Content $ReportPath -Raw | ConvertFrom-Json
$s = $report.summary

$total    = [int]$s.total
$passed   = [int]$s.passed
$failed   = [int]$s.failed
$skipped  = [int]$s.skipped
$flaky    = [int]$s.flaky
$passRate = $s.passRate
$duration = $s.duration

if ($failed -gt 0) {
    $status = "FAILED"
    $color  = "#c62828"
} elseif ($report.interrupted) {
    $status = "INTERRUPTED"
    $color  = "#ef6c00"
} else {
    $status = "PASSED"
    $color  = "#2e7d32"
}

$subject = "$SubjectPrefix $status - $passed passed, $failed failed"

# Build the failed-test list
$failedRows = ""
$failures = @($report.results | Where-Object { $_.status -eq "failed" })

if ($failures.Count -gt 0) {
    foreach ($f in $failures) {
        $title = [System.Web.HttpUtility]::HtmlEncode($f.title)
        $file  = [System.Web.HttpUtility]::HtmlEncode($f.file)
        $err   = ""
        if ($f.error) {
            $raw = [string]$f.error
            if ($raw.Length -gt 400) { $raw = $raw.Substring(0, 400) + "..." }
            $err = [System.Web.HttpUtility]::HtmlEncode($raw)
        }
        $failedRows += @"
<tr>
  <td style="padding:10px;border-bottom:1px solid #eee;vertical-align:top">
    <div style="font-weight:600;color:#c62828">$title</div>
    <div style="color:#777;font-size:12px;margin-top:3px">$file</div>
    <div style="color:#555;font-size:12px;margin-top:6px;font-family:Consolas,monospace;white-space:pre-wrap">$err</div>
  </td>
</tr>
"@
    }
    $failedSection = @"
<h3 style="margin:24px 0 8px;font-size:15px">Failed test cases ($($failures.Count))</h3>
<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee;border-radius:6px">
$failedRows
</table>
"@
} else {
    $failedSection = '<p style="color:#2e7d32;font-weight:600;margin-top:24px">No failures.</p>'
}

$interruptedNote = ""
if ($report.interrupted) {
    $interruptedNote = '<p style="background:#fff3e0;border-left:4px solid #ef6c00;padding:10px;margin:16px 0">This run was stopped before all tests completed. The numbers below cover only the tests that ran.</p>'
}

$body = @"
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:700px;color:#222">
  <div style="background:$color;color:#fff;padding:16px 20px;border-radius:6px 6px 0 0">
    <div style="font-size:18px;font-weight:600">skyCommand Automation - $status</div>
    <div style="font-size:13px;opacity:.9;margin-top:4px">$($report.generatedAt)</div>
  </div>

  <div style="border:1px solid #eee;border-top:none;padding:20px;border-radius:0 0 6px 6px;background:#fafafa">
    $interruptedNote

    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee;border-radius:6px">
      <tr>
        <td style="padding:12px;border-bottom:1px solid #eee">Total tests</td>
        <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;font-weight:600">$total</td>
      </tr>
      <tr>
        <td style="padding:12px;border-bottom:1px solid #eee;color:#2e7d32">Passed</td>
        <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#2e7d32;font-size:18px">$passed</td>
      </tr>
      <tr>
        <td style="padding:12px;border-bottom:1px solid #eee;color:#c62828">Failed</td>
        <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#c62828;font-size:18px">$failed</td>
      </tr>
      <tr>
        <td style="padding:12px;border-bottom:1px solid #eee">Skipped</td>
        <td style="padding:12px;border-bottom:1px solid #eee;text-align:right">$skipped</td>
      </tr>
      <tr>
        <td style="padding:12px;border-bottom:1px solid #eee">Flaky</td>
        <td style="padding:12px;border-bottom:1px solid #eee;text-align:right">$flaky</td>
      </tr>
      <tr>
        <td style="padding:12px;border-bottom:1px solid #eee">Pass rate</td>
        <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;font-weight:600">$passRate%</td>
      </tr>
      <tr>
        <td style="padding:12px">Duration</td>
        <td style="padding:12px;text-align:right">$duration s</td>
      </tr>
    </table>

    $failedSection

    <p style="color:#777;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
      Environment: $($report.baseUrl)<br>
      Full HTML report: run <code>npm run report</code> in the automation folder.
    </p>
  </div>
</div>
"@

Add-Type -AssemblyName System.Web -ErrorAction SilentlyContinue

if ($DryRun) {
    Write-Host "  DRY RUN - no mail sent."
    Write-Host "  To:      $To"
    Write-Host "  Subject: $subject"
    Write-Host "  Failed tests listed: $($failures.Count)"
    Write-Host "  HTML body length: $($body.Length) chars"
    $preview = Join-Path (Split-Path $ReportPath -Parent) "email-preview.html"
    $body | Out-File -FilePath $preview -Encoding utf8
    Write-Host "  Preview written to: $preview"
    exit 0
}

# Send over SMTP.
#
# The new Outlook for Windows has no COM automation, so mail goes out over
# SMTP instead. Credentials come from the environment - never hard-coded.
#   SMTP_USER  sending address
#   SMTP_PASS  app password (NOT your normal sign-in password)
#   SMTP_HOST  defaults to smtp.office365.com
#   SMTP_PORT  defaults to 587 (STARTTLS)

$smtpUser = $env:SMTP_USER
$smtpPass = $env:SMTP_PASS
$smtpHost = if ($env:SMTP_HOST) { $env:SMTP_HOST } else { "smtp.office365.com" }
$smtpPort = if ($env:SMTP_PORT) { [int]$env:SMTP_PORT } else { 587 }

if (-not $smtpUser -or -not $smtpPass) {
    Write-Host "  Email not sent - SMTP_USER / SMTP_PASS are not set in .env"
    Write-Host "  Summary: $passed passed, $failed failed, $skipped skipped ($passRate%)"
    Write-Host "  Preview the email with: npm run mail:preview"
    exit 0
}

try {
    $mail = New-Object System.Net.Mail.MailMessage
    $mail.From = New-Object System.Net.Mail.MailAddress($smtpUser, "skyCommand Automation")
    $mail.To.Add($To)
    $mail.Subject = $subject
    $mail.Body = $body
    $mail.IsBodyHtml = $true

    $smtp = New-Object System.Net.Mail.SmtpClient($smtpHost, $smtpPort)
    $smtp.EnableSsl = $true
    $smtp.Credentials = New-Object System.Net.NetworkCredential($smtpUser, $smtpPass)
    $smtp.Send($mail)

    Write-Host "  Results email sent to $To"
    Write-Host "  Subject: $subject"
}
catch {
    Write-Host "  Could not send the email: $($_.Exception.Message)"
    Write-Host "  Summary: $passed passed, $failed failed, $skipped skipped ($passRate%)"
    Write-Host "  (Test results are unaffected.)"
    exit 0
}
