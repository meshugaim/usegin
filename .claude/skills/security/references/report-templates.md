# Report Templates

Output templates for different security skill modes and audiences. Use as starting structures — adapt to the specific investigation.

---

## Audit Report (Internal)

For auditing a compliance document (DPA, SOC2 controls) against actual implementation.

```markdown
# [Document/Standard] Compliance Audit
**Date:** YYYY-MM-DD
**Scope:** [What was audited]
**Auditor:** Claude (automated, evidence-based)

## Executive Summary
[2-3 sentences: overall posture, number of gaps by severity, confidence level]

## Methodology
- Evidence sources: codebase analysis, database queries, infrastructure inspection
- Evidence levels used: code-verified, infra-queried, documented, inferred, assumed
- Verification: independent sub-agent verification of all findings

## Findings

### [Section/Requirement Name]

**Requirement:** [What the document/standard says]
**Status:** Implemented | Partially Implemented | Not Implemented | Unable to Verify
**Evidence Level:** Code-verified | Infra-queried | Documented | Inferred | Assumed

**Evidence:**
[What was found — file paths, SQL results, configuration values]

**Gap (if any):**
[What's missing or incomplete]

**Recommendation:**
[What to do about it]

**Effort:** Low | Medium | High
**Priority:** Critical | High | Medium | Low

---

[Repeat for each requirement]

## Summary Matrix

| Requirement | Status | Evidence | Priority | Effort |
|-------------|--------|----------|----------|--------|
| ... | ... | ... | ... | ... |

## Confidence Assessment
- Claims verified at code level: X/Y
- Claims verified at infrastructure level: X/Y
- Claims based on platform documentation: X/Y
- Claims that could not be independently verified: X/Y
- Overall confidence: [High/Medium/Low] — [why]

## Recommended Next Steps
1. [Critical gaps — address immediately]
2. [High-priority improvements]
3. [Medium-term hardening]
```

---

## Question Response (Internal)

For answering a specific security question with evidence.

```markdown
# [Question]
**Date:** YYYY-MM-DD
**Requested by:** [who asked]

## Answer
[Direct, concise answer — lead with the verdict]

## Evidence
[Detailed findings with file references and code snippets]

### What We Verified
- [Finding 1 — evidence level: code-verified]
- [Finding 2 — evidence level: infra-queried]

### What We Could Not Verify
- [Item — and why]

## Caveats
[Assumptions, limitations, things that depend on infrastructure we can't query]

## Recommendations
[Improvements related to this topic, if any]
```

---

## Customer Security Overview

For generating or updating the customer-facing security document. Professional tone, honest about gaps with mitigation context. No internal file paths or implementation details.

```markdown
# [Company Name] Security Overview

## Overview
[1-2 paragraphs: what the product does, security philosophy, scope of this document]

## 1. Data Scope & Customer Control
- [How data enters the system]
- [Customer control over data inclusion]
- [What data is NOT collected]

## 2. Tenant Isolation & Data Separation
- [Architecture approach: multi-tenant with logical isolation]
- [How data is scoped and access-controlled]
- [Cross-tenant protection measures]

## 3. Access Control & Authentication
- [Authentication methods]
- [Role-based access]
- [Internal access restrictions]

## 4. Encryption & Data Protection
- [In-transit encryption]
- [At-rest encryption]
- [Key management approach]

## 5. Data Retention & Deletion
- [Customer deletion capabilities]
- [Retention policies]
- [End-of-engagement data handling]

## 6. AI & Data Handling
- [Customer data not used for training]
- [Processing scope]
- [AI subprocessor obligations]

## 7. Subprocessors & Infrastructure
[Table of subprocessors with services performed]

| Subprocessor | Services Performed |
|---|---|
| ... | ... |

All subprocessors are contractually bound to data protection obligations aligned with our DPA.

## 8. Security Practices
- [Development practices]
- [Vulnerability management]
- [Monitoring and logging]

## 9. Incident Response
- [Detection and response process]
- [Customer notification commitments]

## 10. Compliance Status
- [Current certifications/assessments]
- [In-progress certifications]
- [Available documentation (DPA, etc.)]

## Contact
[How to reach the security team]
```

---

## Gap Analysis Report

For comparing current state against a target standard (SOC2, CASA, ISO 27001).

```markdown
# [Standard] Gap Analysis
**Date:** YYYY-MM-DD
**Target:** [Specific certification or tier]

## Executive Summary
[Current readiness level, critical gaps count, estimated timeline to ready]

## Current Posture
[Strengths — what we already do well]

## Gap Matrix

| # | Requirement | Category | Current State | Gap | Effort | Priority |
|---|-------------|----------|---------------|-----|--------|----------|
| 1 | ... | ... | ... | ... | ... | ... |

## Detailed Findings

### [Requirement Category]

#### [Specific Requirement]
**Standard says:** [requirement text]
**Current state:** [what we have]
**Gap:** [what's missing]
**To close:** [specific actions needed]
**Effort:** [Low/Medium/High with brief justification]
**Dependencies:** [other gaps or external factors]

---

## Recommended Roadmap

### Phase 1: Quick Wins (can start immediately)
[Items that are low-effort and close real gaps]

### Phase 2: Foundation (1-3 months)
[Core security infrastructure improvements]

### Phase 3: Certification-Ready (3-6 months)
[Final gaps that require significant investment]

## Confidence Assessment
[Same format as audit report]
```

---

## Subprocessor Audit Report

Specialized format for the common task of refreshing the subprocessor list.

```markdown
# Subprocessor Audit
**Date:** YYYY-MM-DD
**DPA Version:** [date/version of current DPA]

## Current DPA List (Attachment 4)
| Subprocessor | Services Listed | Still Accurate? |
|---|---|---|
| ... | ... | Yes / Updated / Removed |

## Services Found in Codebase (not in DPA)
| Service | Purpose | Handles Customer Data? | Should Be Listed? |
|---|---|---|---|
| ... | ... | Yes/No | Yes/No/Discuss |

## Services in DPA No Longer Used
| Subprocessor | Evidence of Removal |
|---|---|
| ... | ... |

## Recommended DPA Updates
1. **Add:** [service] — [reason, what data it processes]
2. **Update:** [service] — [what changed about its use]
3. **Remove:** [service] — [evidence it's no longer used]

## Indirect Subprocessors
[Services that process data through other services — e.g., Unified.to routing data to Google/Linear/Fathom]

## Notes
[Edge cases, services that might or might not qualify as subprocessors, decisions needed]
```

---

## Security Questionnaire Response

For responding to customer security questionnaires. Answers should be evidence-based but appropriate for a non-technical security reviewer.

```markdown
# Security Questionnaire Response
**Customer:** [name]
**Date:** YYYY-MM-DD
**Completed by:** [name + Claude-assisted notation]

## [Question Category]

### Q: [Question text]
**A:** [Clear, direct answer]
**Supporting detail:** [Evidence summary — no internal file paths, but reference policies/practices]

---

[Repeat for each question]

## Attachments Referenced
- Data Processing Addendum (DPA)
- Security Overview
- [Other relevant documents]
```
