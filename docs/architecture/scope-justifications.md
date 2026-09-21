# WingCaster — OAuth Scope Justifications

**Companion to** `provider-app-review-tracker.md`. Paste these into each provider's app-review form.
Created: 2026-09-21.

> Reviewers reject vague or over-broad justifications. Each blurb states: (1) what the scope grants,
> (2) the exact WingCaster feature/user action that uses it, (3) why it's the minimum needed. Every use is
> **agent-initiated** and scoped to accounts the agent **explicitly connects via OAuth**. Edit the bracketed
> bits and trim scopes you don't ship in a given round.

---

## Reusable app description (every provider asks "what does your app do")

> **WingCaster** is a B2B SaaS platform for real-estate agents and agencies. Agents connect their own
> social and business accounts to WingCaster and use it to (a) publish their property listings and
> marketing content, (b) view performance analytics for their own posts, and (c) read and reply to
> inbound inquiries from a unified inbox. WingCaster never posts autonomously — every publish and reply is
> initiated by the agent. Data accessed via these permissions is used only to provide these features to
> the connecting agent, is stored encrypted, is not sold or shared with third parties, and is not used for
> advertising or ad targeting. Agents can disconnect at any time, which revokes access and deletes stored
> tokens.

Keep a **demo/test account + screencast** ready showing each requested permission actually in use — most
providers require it.

---

## Meta — Facebook Pages & Instagram

**`pages_show_list`**
> Lets the agent see and choose which of their own Facebook Pages to connect. WingCaster calls this once
> during the OAuth connect flow so the agent can select the Page they want to publish to; we store only
> the selected Page's ID. Minimum needed to let the agent pick the correct Page rather than typing an ID.

**`pages_read_engagement`**
> Used to display the agent's own Page post performance (reactions, comments, shares, reach) inside
> WingCaster's analytics view, and to load comment threads the agent replies to from our unified inbox.
> Read-only and scoped to Pages the agent connected. Not used for advertising.

**`pages_manage_posts`**
> Used to publish the agent's authored content — property listing posts, photos, and link posts — to the
> Facebook Page they connected. Publishing is always triggered by the agent from WingCaster's composer or
> scheduler. This is the minimum scope required to create a post on the agent's behalf.

**`pages_manage_metadata`**
> Used to subscribe the connected Page to WingCaster webhooks so the agent receives new comments and
> Messenger inquiries in the unified inbox in near-real-time, and to manage that subscription on disconnect.
> Scoped to the agent's connected Page only.

**`business_management`**
> Used to resolve the Business/asset relationships needed to confirm the agent has access to the Page and
> Instagram account they are connecting, during the OAuth flow. Minimum needed to validate the connection;
> WingCaster does not modify business settings.

**`instagram_basic`**
> Used to identify the Instagram Business account linked to the agent's connected Page and read its basic
> profile (username, id) shown in WingCaster's connection screen and analytics. Read-only.

**`instagram_content_publish`**
> Used solely to publish agent-authored posts (feed images, carousels, reels, and stories) to the
> Instagram Business account the agent connected. Always agent-initiated from WingCaster's composer or
> scheduler. Minimum scope required to complete a publish.

**`read_insights`**
> Used to show the agent performance metrics for their own Page and Instagram posts (reach, impressions,
> engagement) in WingCaster's analytics view. Read-only; the agent's own accounts only.

**`pages_messaging`** _(only if Messenger replies ship this round)_
> Used to display inbound Messenger inquiries from the connected Page in WingCaster's unified inbox and to
> send the agent's replies. Every reply is composed and sent by the agent; no automated messaging.

## Meta — WhatsApp

**`whatsapp_business_management`**
> Used during Embedded Signup to identify and configure the agent's WhatsApp Business Account and phone
> number so it can be connected to WingCaster. Scoped to the account the agent onboards; used to set up and
> maintain the connection, not to alter unrelated settings.

**`whatsapp_business_messaging`**
> Used to send the agent's WhatsApp messages (approved templates and replies to inbound inquiries) and to
> receive inbound messages into WingCaster's unified inbox. Messaging is initiated by the agent or by
> agent-configured templates; minimum needed to send and receive on the connected number.

---

## LinkedIn

**`openid`, `profile`, `email`**
> Standard OpenID Connect scopes used to identify the agent who is connecting (name, LinkedIn member id,
> email) so WingCaster can attribute posts to the correct connected identity and show which account is
> linked. Used for authentication/identity only.

**`w_member_social`**
> Used to publish the agent's authored content (text, image, and article listing posts) to their own
> LinkedIn profile, initiated by the agent from WingCaster's composer or scheduler. Minimum scope required
> to share on the member's behalf.

**`w_organization_social`** _(only if company-page posting ships)_
> Used to publish agent-authored content to a LinkedIn Company Page the agent administers and connects.
> Agent-initiated; scoped to Pages the agent has admin rights to.

**`r_organization_social`** _(only if company-page analytics/inbox ships)_
> Used to read the connected Company Page's own post engagement for WingCaster's analytics view and to load
> comment threads the agent replies to. Read-only.

**`rw_organization_admin`** _(only if company-page management ships)_
> Used to confirm the agent's admin access to the Company Page during connect and to read the Page's
> administrative details needed to publish on its behalf. Scoped to Pages the agent administers.

---

## X (Twitter)

**`tweet.read`**
> Used to display the agent's own posts and the mentions/replies they respond to inside WingCaster's
> unified inbox and analytics. Read-only; the connected account's context only.

**`tweet.write`**
> Used to publish the agent's authored posts to their own connected X account, initiated by the agent from
> WingCaster's composer or scheduler. Minimum scope required to post on the agent's behalf.

**`users.read`**
> Used to identify the connected account (handle, id, profile) shown on WingCaster's connection screen and
> to attribute posts correctly. Read-only.

**`offline.access`**
> Used to obtain a refresh token so WingCaster can maintain the agent's connection without forcing repeated
> re-authorization. Tokens are stored encrypted and used only to refresh access for the features above.

**`dm.read`, `dm.write`** _(only if X DMs ship)_
> Used to surface inbound direct messages to the connected account in WingCaster's unified inbox and send
> the agent's replies. Every reply is composed and sent by the agent.

---

## TikTok

**`user.info.basic`**
> Used to identify the connected TikTok account (username, open id, avatar) shown on WingCaster's
> connection screen and used to attribute published content. Read-only.

**`video.upload`**
> Used to upload the agent's property/marketing videos to their connected TikTok account as a step in
> publishing. Agent-initiated; minimum needed to stage content for posting.

**`video.publish`** _(Content Posting API — Direct Post)_
> Used to publish the agent's authored videos and photo posts directly to their connected TikTok account,
> initiated by the agent from WingCaster's composer or scheduler. Minimum scope required to complete a
> Direct Post on the agent's behalf.

---

## Google (Gmail)

**`openid`, `email`, `profile`**
> Used to identify the mailbox the agent is connecting so WingCaster can show which email account is linked
> and send from the correct address. Identity only.

**`https://www.googleapis.com/auth/gmail.send`** _(restricted)_
> Used to send email on the agent's behalf from their connected Gmail mailbox — listing notifications,
> lead replies, and agent-composed messages — so email reaches recipients from the agent's own verified
> address rather than a shared system address. Send-only; WingCaster does not read the mailbox with this
> scope. Minimum scope required to send as the agent.

**`https://www.googleapis.com/auth/gmail.readonly`** _(restricted — only if inbound inbox ships)_
> Used to import inbound client email into WingCaster's unified inbox so the agent can see and manage lead
> conversations in one place. Read-only; scoped to the connected mailbox; content is shown only to the
> connecting agent.

**`https://www.googleapis.com/auth/gmail.modify`** _(restricted — only if the agent manages mail from WingCaster)_
> Used to let the agent act on their own inbound mail from WingCaster's inbox — marking read, labeling, and
> sending replies within a thread. Scoped to the connected mailbox and limited to the message-management
> actions the agent performs.

> **Restricted-scope note:** Gmail send/read/modify are Google *restricted* scopes and require OAuth
> verification plus a CASA security assessment. Request only the scopes whose features actually ship;
> `gmail.send` alone (send-only, no mailbox read) is the lightest path and preferred for the first round.

---

## Microsoft (Outlook / Graph, delegated per-tenant mailbox)

**`openid`, `email`, `profile`, `User.Read`**
> Used to identify the agent connecting their Outlook/Microsoft 365 mailbox (name, email, id) so WingCaster
> can show the linked account and send from the correct address. Identity only.

**`offline_access`**
> Used to obtain a refresh token so WingCaster can keep the mailbox connected without repeated
> re-authorization. Tokens stored encrypted; used only to refresh access for the features below.

**`Mail.Send`**
> Used to send email on the agent's behalf from their connected mailbox — listing notifications, lead
> replies, and agent-composed messages — so mail comes from the agent's own address. Minimum needed to
> send as the agent.

**`Mail.ReadWrite`** _(only if the agent manages inbound mail from WingCaster)_
> Used to import the agent's inbound client email into WingCaster's unified inbox and let the agent reply
> to, and organize, their own messages from within WingCaster. Scoped to the connected mailbox; content is
> shown only to the connecting agent.

> **Note:** this is a **separate, delegated** per-tenant mailbox registration. It does not replace the
> existing app-only client-credentials Graph app used for WingCaster's platform OTP email. Consider
> Publisher Verification to remove the unverified-app consent warning; request `Mail.ReadWrite` only if the
> inbound-management feature ships (send-only `Mail.Send` is the lighter first round).
