/**
 * SHR-LEG-004 — Cookie / Data Processing Notice.
 *
 * Consent/transparency requirement for a public paid launch (GDPR + MENA
 * data-protection expectations). Sibling of PrivacyPage / TermsPage.
 */
export function CookieNoticePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Cookie &amp; Data Processing Notice</h1>
      <div className="max-w-none space-y-4 text-muted-foreground leading-relaxed">
        <p className="mb-4">
          This notice explains the cookies and similar technologies WingCaster uses, and how we process personal data.
          It supplements our{' '}
          <a href="/privacy" className="underline underline-offset-4">Privacy Policy</a>.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">1. What cookies we use</h2>
        <p className="mb-4">
          <span className="font-medium text-foreground">Strictly necessary</span> — required to sign you in, keep your
          session secure, and remember your preferences. These cannot be switched off.
          {' '}
          <span className="font-medium text-foreground">Analytics &amp; performance</span> — help us understand how the
          platform is used so we can improve it. These are set only where permitted and can be declined without losing
          core functionality.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">2. Managing your choices</h2>
        <p className="mb-4">
          You can accept or decline non-essential cookies from the consent control shown on your first visit, and
          change your choice at any time in your browser settings. Blocking strictly necessary cookies may prevent parts
          of the platform from working.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">3. How we process your data</h2>
        <p className="mb-4">
          We process personal data to operate the platform, route inquiries between agents and prospective clients,
          process payments, send notifications you have opted into, and meet legal obligations. Our legal bases include
          performing our contract with you, your consent (where required), and our legitimate interests in running and
          securing the service.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">4. Processors we rely on</h2>
        <p className="mb-4">
          We share limited data with service providers who process it on our behalf under contract, including our
          payments merchant of record (Paddle), our email and messaging providers, and our error-monitoring and
          analytics providers. They may only use the data to provide their service to us.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">5. International transfers &amp; retention</h2>
        <p className="mb-4">
          Some processors operate outside your country; where data is transferred internationally we rely on
          appropriate safeguards. We keep personal data only as long as needed for the purposes above and in line with
          the retention rules that apply to your territory.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">6. Your rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal data, and object to or restrict
          certain processing, subject to applicable law. See the{' '}
          <a href="/privacy" className="underline underline-offset-4">Privacy Policy</a> for how to exercise these
          rights.
        </p>
      </div>
    </div>
  )
}
