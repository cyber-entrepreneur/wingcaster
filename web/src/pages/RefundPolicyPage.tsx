/**
 * SHR-LEG-003 — Refund Policy.
 *
 * Required for taking payment through Paddle (our merchant of record):
 * Paddle mandates a published refund policy before a domain is approved for
 * live checkout. Sibling of PrivacyPage / TermsPage; same static structure.
 */
export function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Refund Policy</h1>
      <div className="max-w-none space-y-4 text-muted-foreground leading-relaxed">
        <p className="mb-4">
          This Refund Policy applies to subscriptions and credit purchases made on WingCaster. Payments are
          processed by our merchant of record, Paddle, whose{' '}
          <a
            href="https://www.paddle.com/legal/checkout-buyer-terms"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            buyer terms
          </a>{' '}
          also apply to every transaction.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">1. Subscriptions</h2>
        <p className="mb-4">
          Subscription fees are billed in advance for each billing period (monthly or annual). You may cancel at any
          time from Settings → Billing; cancellation stops future renewals and your plan remains active until the end
          of the current paid period. We do not provide pro-rated refunds for the unused portion of a period once it
          has started, except where required by law.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">2. Credits and top-ups</h2>
        <p className="mb-4">
          Credits purchased for metered features (such as publishing and messaging) are non-refundable once consumed.
          Unused credits from a top-up may be refunded within 14 days of purchase provided none of that top-up has been
          spent. Credits do not expire while your account is active.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">3. Statutory cooling-off rights</h2>
        <p className="mb-4">
          Where you are entitled to a statutory right of withdrawal (for example, certain consumers in the EU/UK), you
          may cancel within the applicable cooling-off period for a full refund, unless you asked us to begin the
          service immediately and it has been fully performed. Nothing in this policy limits rights you have under
          applicable law.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">4. Duplicate or incorrect charges</h2>
        <p className="mb-4">
          If you are charged in error, twice for the same item, or an amount you did not authorise, contact us and we
          will investigate and refund any incorrect charge in full.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">5. How to request a refund</h2>
        <p className="mb-4">
          Email <a href="mailto:billing@wingcaster.com" className="underline underline-offset-4">billing@wingcaster.com</a>{' '}
          from the address on your account, including your account name and the transaction reference from your Paddle
          receipt. We aim to respond within 5 business days. Approved refunds are returned to your original payment
          method by Paddle; the time to appear on your statement depends on your bank or card issuer.
        </p>

        <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground">6. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. The version in effect at the time of your purchase governs that
          purchase.
        </p>
      </div>
    </div>
  )
}
