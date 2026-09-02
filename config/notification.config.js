/**
 * Email notification settings.
 *
 * Mail is sent through the Outlook desktop app already signed in on this
 * machine (via COM automation), so no SMTP server, API key or password is
 * needed. Outlook must be installed; it does not need to be open.
 */
export default {
  enabled: true,

  email: {
    // Leave blank to send from whichever account Outlook is signed in as.
    from: '',
    recipients: ['umeshgouda.hiregoudra@skypoint.ai'],
    ccRecipients: [],
    subjectPrefix: '[skyCommand Automation]',
  },

  triggers: {
    // Send after every run, whether it passed, failed, or was interrupted.
    onSuccess: true,
    onFailure: true,
    onInterrupted: true,
  },

  includeDetails: {
    failedTests: true,
    maxFailuresInEmail: 25,
    environmentInfo: true,
    errorSnippet: true,
  },
};
