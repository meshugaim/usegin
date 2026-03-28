# Compliance Standards Reference

Key requirements from common standards AskEffi may need to meet. Use this as an investigation checklist — map each requirement to an investigation target from `investigation-targets.md`.

This is not exhaustive. For full standard requirements, consult the authoritative sources. This file provides enough structure to scope an investigation and identify obvious gaps.

---

## SOC 2 Type II

SOC 2 is organized around five Trust Service Criteria. For a startup at pilot/early production stage, Security is mandatory; Availability and Confidentiality are common additions; Processing Integrity and Privacy are less common but may be required by specific customers.

### CC1: Control Environment (Security)
- [ ] Defined security policies and procedures
- [ ] Security awareness training for staff
- [ ] Organizational structure with clear security responsibilities
- [ ] Background checks for employees with data access

### CC2: Communication and Information
- [ ] Internal communication of security policies
- [ ] External communication of security commitments (Security Overview, DPA)
- [ ] System description available to customers

### CC3: Risk Assessment
- [ ] Risk assessment process documented
- [ ] Risk identification for security threats
- [ ] Risk mitigation strategies defined

### CC4: Monitoring Activities
- [ ] Continuous monitoring of security controls
- [ ] Error monitoring and alerting (Sentry)
- [ ] Admin audit logging
- [ ] Regular review of access controls

### CC5: Control Activities
- [ ] Logical access controls (authentication, RLS)
- [ ] Change management process (git, code review, CI/CD)
- [ ] System operations monitoring (health checks, dashboards)

### CC6: Logical and Physical Access Controls
- [ ] User authentication (magic link, OAuth)
- [ ] Role-based access (admin checks, RLS policies)
- [ ] Least-privilege access (service-role segregation)
- [ ] Access provisioning and deprovisioning
- [ ] Multi-factor authentication (if applicable)
- [ ] Encryption in transit (TLS)
- [ ] Encryption at rest
- [ ] Key management

### CC7: System Operations
- [ ] Vulnerability management (dependency scanning, updates)
- [ ] Incident detection and response
- [ ] Backup and recovery procedures
- [ ] Change management (deployment pipeline)

### CC8: Change Management
- [ ] Authorized changes only (protected branches, CI gates)
- [ ] Testing before deployment (unit, integration, e2e)
- [ ] Separation of environments (dev, staging, production)

### CC9: Risk Mitigation
- [ ] Vendor risk management (subprocessor DPAs)
- [ ] Business continuity planning
- [ ] Disaster recovery procedures

### Availability (A1)
- [ ] Uptime monitoring and SLAs
- [ ] Capacity planning
- [ ] Disaster recovery testing
- [ ] Backup verification

### Confidentiality (C1)
- [ ] Data classification
- [ ] Confidential data identification and protection
- [ ] Data retention and disposal policies
- [ ] Encryption of confidential data

---

## CASA (Cloud Application Security Assessment)

Google's CASA verification for apps accessing Google user data. Requirements depend on the tier (1-3) based on data sensitivity and scope.

### Tier 1 (Self-Assessment)
- [ ] OWASP Top 10 self-assessment
- [ ] Security questionnaire completion
- [ ] Privacy policy published

### Tier 2 (Lab Assessment)
- [ ] All Tier 1 requirements
- [ ] External security assessment by authorized lab
- [ ] Vulnerability scanning results
- [ ] Penetration testing (if required)

### Tier 3 (Full Assessment)
- [ ] All Tier 2 requirements
- [ ] Full application security assessment
- [ ] Annual reassessment

### Common CASA Requirements (All Tiers)
- [ ] Secure data storage (no sensitive data in logs, local storage)
- [ ] Secure network communication (TLS everywhere)
- [ ] Authentication and session management
- [ ] Input validation and output encoding
- [ ] Error handling without information leakage
- [ ] Access control enforcement
- [ ] Data minimization (only request necessary OAuth scopes)
- [ ] Secure OAuth implementation (PKCE, state parameter)
- [ ] Token storage security (not in URLs, localStorage)

### AskEffi-Specific CASA Considerations
- Google Drive integration uses OAuth via Unified.to — verify PKCE flow
- File content indexed in GFS/VAIS — verify data handling agreements
- OAuth scopes: check that only necessary permissions are requested
- Token refresh: verify tokens aren't stored insecurely

---

## GDPR / DPA Compliance

Requirements for the Data Processing Addendum, particularly relevant for EU customers.

### Article 28 (Processor Obligations)
- [ ] Process only on documented instructions (DPA Section 1.1-1.2)
- [ ] Ensure confidentiality of processing personnel (DPA Section 1.4)
- [ ] Implement appropriate technical and organizational measures (DPA Attachment 3)
- [ ] Sub-processor management with customer notification (DPA Section 4)
- [ ] Assist with data subject rights (DPA Section 2.1)
- [ ] Assist with security incident notification (DPA Section 2.3)
- [ ] Delete or return data on termination (DPA Section 1.6)
- [ ] Make available information for audits (DPA Section 3)

### Technical Measures (DPA Attachment 3 — "Data Security Exhibit")
These are the specific commitments in AskEffi's DPA:

1. **Information security program** — administrative, technical, and organizational safeguards
2. **Access controls** — least-privilege, need-to-know, prompt access termination
3. **Account management** — unique credentials per user, strict admin account management
4. **Vulnerability management** — automated scanning, patch management, severity-based remediation
5. **Security segmentation** — firewalls, proxies, network-based intrusion detection
6. **Data loss prevention** — automated exfiltration detection, secure portable device use
7. **Encryption** — industry-standard encryption for data in transit and at rest, key management
8. **Physical safeguards** — physical access controls for systems

### Data Transfer Mechanisms
- [ ] Standard Contractual Clauses (SCCs) for EEA transfers
- [ ] UK IDTA for UK transfers
- [ ] Swiss FADP compliance for Swiss transfers
- [ ] Data Privacy Framework (if applicable)

### Sub-Processor Requirements
- [ ] Complete and current sub-processor list
- [ ] 15 days advance notice for new sub-processors (per DPA Section 4.2.1)
- [ ] Data protection obligations imposed on sub-processors (DPA Section 4.3)
- [ ] Customer objection mechanism (DPA Section 4.2.2)

---

## Quick Reference: What Standard Needs What

| Requirement | SOC 2 | CASA | GDPR/DPA |
|-------------|-------|------|----------|
| Authentication | CC6 | Required | Art. 28 |
| Encryption in transit | CC6 | Required | Att. 3.7 |
| Encryption at rest | CC6 | Recommended | Att. 3.7 |
| Access control (RLS) | CC6 | Required | Att. 3.2 |
| Vulnerability scanning | CC7 | Tier 2+ | Att. 3.4 |
| Audit logging | CC4 | Recommended | Art. 28 |
| Incident response | CC7 | Required | Art. 33 |
| Data deletion | C1 | Required | Art. 17 |
| Sub-processor management | CC9 | N/A | Art. 28 |
| Penetration testing | CC7 | Tier 2+ | Recommended |
| Security training | CC1 | Recommended | Recommended |
| Backup/recovery | A1 | Recommended | Recommended |
