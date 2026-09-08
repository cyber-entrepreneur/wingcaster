from pathlib import Path
import re

# --- server.js: take BE-06 register call ---
sp = Path("backend/src/server.js")
s = sp.read_text(encoding="utf-8")
pat = re.compile(r"<<<<<<< HEAD\r?\n.*?>>>>>>> origin/main\r?\n", re.S)
s2, n = pat.subn(
    "// BE-BLOCKER-06 — slug apply + promoted agency_applications (after /search so\n"
    "// :id/:slug params cannot shadow the static search path).\n"
    "registerAgencyApplicationRoutes(app)\n",
    s,
    count=1,
)
if n != 1:
    raise SystemExit(f"server replace count={n}")
if "<<<<<<<" in s2:
    raise SystemExit("server still conflict")
# Drop unused agencyApplicationExpiresAt import if no longer referenced in server.js
if "agencyApplicationExpiresAt(" not in s2:
    s2 = s2.replace(
        "import {\n  agencyApplicationExpiresAt,\n  runAgencyApplicationExpiryTick,\n} from './workers/agency-application-expiry.js'\n",
        "import {\n  runAgencyApplicationExpiryTick,\n} from './workers/agency-application-expiry.js'\n",
    )
sp.write_text(s2, encoding="utf-8")
print("server ok")

# --- table-mapper: single agency_applications with uplift + expires_at ---
mp = Path("backend/src/persistence/table-mapper.js")
m = mp.read_text(encoding="utf-8")
# Remove the first (BE-06) block and the duplicate BE-09 block; insert one combined
first = """  agency_applications: {
    schema: 'public',
    table: 'agency_applications',
    columns: [
      'agency_id', 'applicant_user_id', 'agent_email', 'agent_name', 'agent_phone', 'message',
      'current_listings_count', 'portfolio_url', 'availability', 'referral_source',
      'profile_share_consent', 'invitation_code', 'expected_response_by', 'status',
      'approved_at', 'approved_by', 'approved_role', 'affiliation_mode',
      'rejected_at', 'rejected_by',
    ],
  },
"""
dup = """  // BE-BLOCKER-09 / BE-06: first-class agency_applications (was legacy_collections).
  // expires_at is required for the daily expiry cron; remaining uplift columns
  // may arrive via migration 324 — keep this list additive-compatible.
  agency_applications: {
    schema: 'public',
    table: 'agency_applications',
    columns: [
      'agency_id', 'agent_email', 'agent_name', 'agent_phone', 'message', 'status',
      'expires_at', 'approved_at', 'approved_by', 'approved_role', 'affiliation_mode',
      'rejected_at', 'rejected_by',
    ],
  },
"""
combined = """  agency_applications: {
    schema: 'public',
    table: 'agency_applications',
    columns: [
      'agency_id', 'applicant_user_id', 'agent_email', 'agent_name', 'agent_phone', 'message',
      'current_listings_count', 'portfolio_url', 'availability', 'referral_source',
      'profile_share_consent', 'invitation_code', 'expected_response_by', 'status',
      'expires_at', 'approved_at', 'approved_by', 'approved_role', 'affiliation_mode',
      'rejected_at', 'rejected_by',
    ],
  },
"""
if first not in m:
    raise SystemExit("first agency_applications block not found")
if dup not in m:
    # try with special dash encoding
    raise SystemExit("dup agency_applications block not found: " + repr(m[m.find("BE-BLOCKER-09"):m.find("BE-BLOCKER-09")+200]))
m2 = m.replace(first, combined, 1).replace(dup, "", 1)
if m2.count("agency_applications:") != 1:
    raise SystemExit(f"expected 1 agency_applications mapping, got {m2.count('agency_applications:')}")
mp.write_text(m2, encoding="utf-8")
print("mapper ok")
