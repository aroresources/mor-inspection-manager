// EIV Policy & Procedure — master template (Layer 1). Content tracks the
// ARO2030 EIV Policies & Procedures redline v4 (HUD 4350.3 REV-1 Ch. 9 and
// Notice H 2013-06).
//
// Variable parts:
//   - {{mergeKey}} tokens  -> entity merge fields (name/address/phone/company)
//   - the EIV Schedule     -> per-property frequency (quarterly ▸ monthly) + filing
//   - policy version + effective date (company default, property override)
// Everything else is fixed HUD text. No per-person or per-site specifics are
// embedded in the body (role-only language, generic storage wording).

export type ListItem = string | { text: string; sub?: ListItem[] }
export type Block =
  | { k: 'p'; text: string }
  | { k: 'h'; text: string }
  | { k: 'ul'; items: ListItem[] }
  | { k: 'schedule' }
export interface Section { id: string; title: string; blocks: Block[] }

export interface ScheduleChoice { frequency?: 'Quarterly' | 'Monthly'; file?: boolean; include?: boolean }
export interface EivSettings {
  merge?: Record<string, string>
  schedule?: Record<string, ScheduleChoice>
  version?: string
  effectiveDate?: string
}

export const EIV_MERGE_FIELDS = [
  { key: 'sitename', label: 'Property name', entity: true },
  { key: 'address', label: 'Property address', entity: true },
  { key: 'phone', label: 'Property phone', entity: true },
  { key: 'company', label: 'Management company', entity: true },
]

// --- EIV Schedule definition ------------------------------------------------
export interface ScheduleRow {
  key?: string
  group?: string
  report?: string
  freq?: string
  monthlyOption?: boolean
  fileText?: string
  fileOption?: boolean
  optIn?: boolean
  fixed?: boolean
}
export const EIV_SCHEDULE: ScheduleRow[] = [
  { group: 'Income Reports' },
  { key: 'income_summary', report: 'Income Summary Report', freq: 'MI/IC (within 90 days), AR, IR', fileText: 'Tenant file, together with supporting docs', fixed: true },
  { key: 'income_report', report: 'Income Report', freq: 'MI/IC (within 90 days), AR, IR', fileText: 'Tenant file, together with the applicable 50059', fixed: true },
  { key: 'income_discrepancy', report: 'Income Discrepancy Report', freq: 'MI/IC (within 90 days), AR, IR', fileText: 'Tenant file, together with supporting docs', fixed: true },
  { key: 'no_income_50059', report: 'No Income Reported on 50059', freq: 'Quarterly', monthlyOption: true, fileText: 'Not required', fileOption: true },
  { key: 'no_income_hhs_ssa', report: 'No Income Reported by HHS or SSA', freq: 'Quarterly', monthlyOption: true, fileText: 'Not required', fileOption: true },
  { key: 'new_hires', report: 'New Hires Report', freq: 'Quarterly', monthlyOption: true, fileText: 'Summary → New Hires Report Master File; Detail → tenant file, with supporting docs' },
  { group: 'Verification Reports' },
  { key: 'existing_tenant', report: 'Existing Tenant Search', freq: 'When processing applicant for admission (all members)', fixed: true, fileText: 'If not admitted → kept with the application; if admitted → tenant file, with supporting docs' },
  { key: 'multiple_subsidy', report: 'Multiple Subsidy', freq: 'Quarterly', monthlyOption: true, fileText: 'Summary → Multiple Subsidy Master File; Detail → tenant file, with supporting docs' },
  { key: 'deceased', report: 'Deceased Tenant Report', freq: 'Quarterly', monthlyOption: true, fileText: 'Summary → Deceased Tenant Report Master File; docs → tenant file' },
  { group: 'Identity Verification Reports' },
  { key: 'failed_prescreen', report: 'Failed EIV Pre-Screening Report', freq: 'Monthly', fixed: true, fileText: 'Failed EIV Pre-Screening Master File; docs → tenant file' },
  { key: 'failed_verification', report: 'Failed Verification Report', freq: 'Monthly', fixed: true, fileText: 'Failed Verification Master File; docs → tenant file' },
  { key: 'not_verified', report: 'Number of Households Not-Verified', freq: 'Optional', optIn: true, fileText: 'Not required' },
]

export const scheduleFrequency = (row: ScheduleRow, settings?: EivSettings): string => {
  const choice = settings?.schedule?.[row.key || '']
  if (row.monthlyOption && choice?.frequency === 'Monthly') return 'Monthly'
  return row.freq || ''
}
export const scheduleFiling = (row: ScheduleRow, settings?: EivSettings): string => {
  const choice = settings?.schedule?.[row.key || '']
  if (row.fileOption && choice?.file) return 'Printed and filed (property elects to file)'
  return row.fileText || ''
}
export const scheduleIncluded = (row: ScheduleRow, settings?: EivSettings): boolean => {
  if (!row.optIn) return true
  return !!settings?.schedule?.[row.key || '']?.include
}

// --- The template sections --------------------------------------------------
export const EIV_SECTIONS: Section[] = [
  {
    id: 'introduction', title: 'Introduction', blocks: [
      { k: 'p', text: 'The Enterprise Income Verification System, or EIV, is mandatory as of 1/31/10. All recertifications with an effective date of 6/1/10 or later must reflect EIV use. EIV is a way for O/A’s to verify tenant employment and income at recertification and to reduce administrative and subsidy payment errors. EIV does not contain income information for applicants; applicant income must be verified using other acceptable verification methods.' },
      { k: 'p', text: 'As per HUD Guidelines, Owner/Agents must have written policies & procedures for staff to follow to ensure that applicants and tenants are treated fairly and are not being discriminated against.' },
      { k: 'p', text: 'It is critical that all EIV users become familiar with these policies and procedures as well as with each report, how often it must be used, and what actions are required. HUD’s EIV requirements are set out in HUD Handbook 4350.3 REV-1, Chapter 9, and HUD Notice H 2013-06 (issued March 8, 2013, which superseded Notice H 2010-10). HUD updates these requirements on occasion. Our Policies & Procedures will be updated accordingly.' },
      { k: 'p', text: 'Be Advised: On your MOR, the reviewer will make sure you have written EIV policies and procedures in place, an EIV file containing all required items, and that you are using EIV and using it correctly. Your reviewer will also check security procedures to ensure that you are following HUD-required procedures for security. Failure to use EIV as required can result in an MOR finding and a five percent reduction in the monthly voucher payment until the violation is cured. A new owner or management agent must begin using EIV within 90 days of taking over the property.' },
    ],
  },
  {
    id: 'privacy', title: 'Privacy', blocks: [
      { k: 'p', text: 'When using information from EIV, tenant data will only be used:' },
      { k: 'ul', items: [
        'As a third-party source to verify tenant employment and income to determine a household’s continued eligibility for participation in the property’s HUD rental assistance program;',
        'As a third-party source to verify tenant employment and income to determine the level of assistance that the household is entitled to receive;',
        'To identify and correct prior subsidy overpayments and/or underpayments;',
        'For administrative monitoring/quality control during supervision/training of employees who perform tenant certifications (reviews will be done only by authorized EIV Users, or by Non-Users who have signed the Rules of Behavior and completed security training); and',
        'To determine whether an applicant or current tenant is currently receiving rental assistance at another Multifamily Housing or Public and Indian Housing (PIH) location.',
      ] },
      { k: 'p', text: 'The data will not be disclosed in any way that would violate the privacy of the individuals whose data is included in the system.' },
      { k: 'p', text: 'During the certification interviews, each tenant will be provided with visual access to records pertaining to him/herself and an opportunity to dispute the contents of the records.' },
      { k: 'p', text: 'A tenant may request assistance during his/her certification interview. In this case, s/he must sign a written consent (e.g., the sample consent in 4350.3 Exhibit 9-4) allowing the person(s) assisting (e.g., a relative, social worker, translator, or a Service Coordinator who is present and assisting with the recertification) to view his/her EIV data during the interview process.' },
      { k: 'p', text: 'Management cannot provide copies of any EIV data to any third party, even upon tenant request. However, an adult tenant may request a copy of his/her own EIV data from management. Another adult household member’s data will not be included unless that member has given written consent. A record showing which EIV data was released to the tenant will be signed and dated by both the tenant and management and kept in the tenant file. Security of this data then becomes the tenant’s responsibility.' },
      { k: 'p', text: 'The EIV data of an adult household member will not be shared with (i.e., no copies will be provided, nor will the printout be displayed to) another adult household member, or to anyone assisting the tenant during the recertification process or interview, unless the individual has provided written consent to disclose the EIV information.' },
      { k: 'p', text: 'Note: HUD allows management to show and discuss with the Head of Household how the family’s income and rent were determined, based on the total income reported and verified.' },
    ],
  },
  {
    id: 'staff_roles', title: 'Staff Roles', blocks: [
      { k: 'p', text: 'The following are the roles in the company and their responsibilities as they pertain to EIV:' },
      { k: 'h', text: 'Owner/Manager' },
      { k: 'ul', items: [
        'Authorize EIV Coordinators by signing an Owner Approval Letter for each Coordinator (see below).',
        'Provide final oversight of the staff, especially the EIV Coordinator.',
        'Ensure that, after any change in ownership or management agent, the new owner or agent obtains EIV access and begins using EIV within 90 days.',
      ] },
      { k: 'h', text: 'EIV Coordinator(s)' },
      { k: 'ul', items: [
        'Maintain an initial Coordinator Access Authorization Form (CAAF) and recertify annually; complete security awareness training (the Cyber Awareness Challenge) initially and annually and keep the certificate of completion; and keep the signed CAAF and Owner Approval Letter on file.',
        'Assign access rights to EIV users appropriately, based on their job responsibility.',
        'Oversee the EIV use in the company, staying up to date with any changes, and in general make sure that all regulations are being followed. This includes making sure that all authorized Users are using EIV data in accordance with HUD regulations, that they are appropriately safeguarding EIV information, and that all users receive EIV training, including security training, prior to using EIV and again at least annually.',
        'Ensure that each EIV user has their paperwork up to date, including their initial User Access Authorization Form (UAAF), the current online UAAF from each bi-annual (every six months) recertification, the signed Rules of Behavior, and the annual Cyber Awareness Challenge certificate. These records will be made available to HUD or the Contract Administrator on request.',
        'Ensure that any non-user who needs to view EIV reports signs a Rules of Behavior (for Individuals without Access to the EIV System) and completes security awareness training before viewing EIV data and annually thereafter.',
        'Ensure that no one has unauthorized access to EIV, including immediately removing the access of employees who leave the company or whose job no longer requires EIV access.',
      ] },
      { k: 'h', text: 'EIV Users' },
      { k: 'ul', items: [
        'Maintain an initial User Access Authorization Form (UAAF), be recertified by the Coordinator bi-annually (every six months), sign the EIV Rules of Behavior (and the TRACS Rules of Behavior), and complete the Cyber Awareness Challenge security training initially and annually.',
        'Run, use, and file the EIV reports in accordance with HUD regulations, this Policy & Procedure manual, and company policy.',
      ] },
      { k: 'h', text: 'EIV Non-Users' },
      { k: 'ul', items: [
        'Sign the Rules of Behavior for Use of Enterprise Income Verification (EIV) Information (for Individuals without Access to the EIV System).',
        'Complete security awareness training before viewing EIV data and annually thereafter.',
      ] },
    ],
  },
  {
    id: 'disclosure', title: 'Disclosure to Tenants', blocks: [
      { k: 'ul', items: [
        'At Move In, and at each subsequent certification, the head of household, spouse, and co-head (regardless of age) and every other adult household member will be asked to sign the HUD-9887 and HUD-9887A.',
        'The HUD-9887, Notice and Consent for the Release of Information, authorizes the owner/manager and HUD (among other government agencies) to provide and share income information with each other.',
        'The HUD-9887A, Applicant’s/Tenant’s Consent to the Release of Information, authorizes the owner/manager to request information about the applicant/tenant directly from third parties (e.g., employers and benefit providers).',
        'A copy of the signed HUD-9887/A will be provided to each adult applicant/tenant.',
        'Details of the disclosure can be found on the HUD-9887/A Fact Sheet, which will also be provided when the 9887/A is signed.',
        'The original signed 9887/A will be kept in the tenant file together with the tenant certification.',
        'If a disability prevents an applicant/tenant from being able to read or understand the forms, a reasonable accommodation will be made.',
        'At Move In, and at each subsequent certification, a copy of the “EIV and You” brochure will be given to each applicant/tenant. Receipt of the brochure will be documented in the tenant file.',
        'Current, signed forms HUD-9887 and HUD-9887-A (the HUD-9887 is valid for 15 months from the date of signature) must be in the tenant file for each adult household member (except live-in aides) and for the head of household, spouse, and co-head regardless of age, before that member’s EIV Income Report information is viewed or used. The signed HUD-9887-A must also be on file before written third-party verification is requested.',
        'A signed HUD-9887/9887-A is not required to view or use the Existing Tenant Search or the other EIV Verification Reports (Multiple Subsidy, Identity Verification, and Deceased Tenants reports).',
        { text: 'When a household member turns 18, he/she must report to management and sign the HUD-9887 and HUD-9887-A within 60 days or by the next recertification, whichever is first. Management will not view or use the EIV Income Report for that member until the forms are signed.', sub: [
          'Failure to report and sign within this timeframe will constitute a lease non-compliance, and the household’s assistance and/or tenancy may be terminated. This notification requirement will be part of the house rules. Management will provide written notice of this requirement to each household with a 17-year-old member at the time of any Annual or Interim certification.',
        ] },
      ] },
    ],
  },
  {
    id: 'security', title: 'Security', blocks: [
      { k: 'p', text: 'EIV information will be kept confidential and will only be used for HUD-approved purposes.' },
      { k: 'p', text: 'All EIV data is subject to the provisions of the Federal Privacy Act of 1974 (5 U.S.C. § 552a) as well as any State and local privacy laws. HUD, owner/manager, and the PHA may be subject to penalties for unauthorized disclosures or improper uses of the income information. Willful unauthorized disclosure of EIV data is a felony punishable by a fine of up to $5,000 or imprisonment for up to five years; unauthorized inspection of EIV data is a misdemeanor punishable by a fine of up to $1,000 and/or imprisonment for up to one year. Civil damages may also apply.' },
      { k: 'p', text: 'Owner/manager will protect the EIV data at all times by the following procedures:' },
      { k: 'h', text: 'Technical Safeguards' },
      { k: 'ul', items: [
        'Each individual with EIV access must have and use their own WASS ID and password. These IDs and passwords cannot be shared.',
        'Coordinators will be recertified annually (by HUD) and Users bi-annually, i.e., every six months (by the Coordinator), to ensure that no unauthorized users have access.',
        'Coordinators and Users will complete the Department of Defense Cyber Awareness Challenge security training before receiving access and annually thereafter, print the Certificate of Completion, and give a copy to the EIV Coordinator. Users will also complete the online EIV Security Awareness Training Questionnaire when the EIV system requires it (at initial access and annually).',
        'Coordinators will monitor EIV access and use to make sure that each user has a legitimate need to use the EIV system, and make modifications to access if there is a change in employment or job responsibility. New users will not be given access until they have trained properly.',
      ] },
      { k: 'h', text: 'Administrative Safeguards' },
      { k: 'ul', items: [
        'Maintain and follow a written Policy & Procedure for the use of EIV at the property.',
        'All EIV Coordinators and Users will be trained either through in-house training by the compliance team, or external training classes offered by various industry experts, or a combination of both.',
        'Initial training will be completed before access to EIV is approved. This training will include a detailed review of EIV rules and regulations as well as a review of these Policies & Procedures.',
        'Annual training will include a review of EIV rules & regulations, these Policies & Procedures, and a review of any changes to the above. Each User’s work will be evaluated in detail to ensure that they are complying with all the above.',
        'All non-Users with access to EIV data will be required to undergo training initially and annually as well. This training will focus on permitted uses of EIV data as well as security.',
        'A log of all EIV training will be maintained, as well as a schedule for all future trainings.',
      ] },
      { k: 'h', text: 'Physical Safeguards' },
      { k: 'p', text: 'The following applies to all printed reports:' },
      { k: 'ul', items: [
        'They will immediately be removed from printer trays and will not be left unattended at any time.',
        'They will not be viewed within viewing distance of unauthorized personnel or visitors.',
        'When not in use, they will immediately be placed in the appropriate file/folder, which will be placed in a secure, locked storage location in a secure area. Only authorized EIV Users, and Non-Users who have signed the Rules of Behavior, completed security training, and need access for their job, may be given keys and/or access to files containing EIV data.',
        'EIV data displayed on computer monitors will only be active when the information is being utilized, and only when no unauthorized persons are within viewing distance.',
        'Electronically stored EIV data on in-office hard drives will be stored only in restricted-access, password-protected directories. EIV data on portable media must be labeled “Confidential” or “For Official Use Only” and encrypted using a NIST-compliant (FIPS 140-validated) encryption product. Independent Public Auditors are not permitted to download any EIV data.',
        'All emails that contain EIV data must be encrypted using a NIST-compliant (FIPS 140-validated) encryption product. The full 9-digit Social Security number for a tenant will not be included in emails or other electronic communications.',
        'When faxing EIV data, the user must ensure that the person receiving the fax is waiting and ready to retrieve it as soon as it is printed.',
        'Where possible, a restricted-access printer, copier, or fax machine will be used. EIV data will be mailed only to an office of the owner/management agent. It will never be mailed to an Independent Public Auditor’s office.',
        { text: 'Any Independent Public Auditor (IPA) hired by the owner to perform a financial audit of the property and to determine the owner’s compliance with income verification requirements and accuracy of rent and subsidy calculation is subject to the following restrictions:', sub: [
          'Can only access EIV income information in hard-copy files, and only inside property offices.',
          'Cannot transmit or transport EIV income information in any form.',
          'Cannot enter or download EIV data to any mobile device or portable media.',
          'Must sign the Rules of Behavior for Non-System Users and abide by its non-disclosure oaths.',
          'Cannot duplicate any EIV income information or re-disclose it to any unauthorized individual.',
        ] },
        'Users will properly log out of the EIV system whenever they leave their computers. Computers used to access EIV will have a password-protected screen saver, and users will lock their computers whenever they leave their workspace.',
        'No EIV data will be shared or co-mingled in files for other programs (such as LIHTC, rural housing, etc.) that are subject to file inspections from agencies other than HUD, unless and until such time as HUD/HHS authorizes this.',
        'If printed EIV data needs to be disposed of, it will be done in a way that will ensure it is destroyed permanently (such as by shredding, burning, or pulverizing). If electronic EIV data needs to be disposed of, it will be done in a way that will ensure it is destroyed permanently (e.g., secure-deletion software that overwrites the data and emptying the recycle bin, or physical destruction of the storage media).',
      ] },
    ],
  },
  {
    id: 'file_retention', title: 'File Retention', blocks: [
      { k: 'ul', items: [
        'Appropriate EIV data will be maintained in the tenant file for a period of the term of tenancy plus three years, and destroyed at the time the tenant file is destroyed. Along with the rest of the tenant file, EIV data will be destroyed in a way that will ensure it is destroyed permanently (such as by shredding, burning, or pulverizing).',
        'EIV printouts kept in master report files will be destroyed in a way that will ensure they are destroyed permanently (such as by shredding, burning, or pulverizing) after three years.',
        'EIV Existing Tenant Search reports for applicants who did not move into the property will be retained, along with their applications, for three years and will then be destroyed in a way that will ensure they are destroyed permanently (such as by shredding, burning, or pulverizing).',
      ] },
    ],
  },
  {
    id: 'improper_disclosure', title: 'Improper Disclosure', blocks: [
      { k: 'ul', items: [
        'Any employee who detects improper disclosure of, unauthorized access to, or security breaches involving EIV data must report them immediately to the EIV Coordinator or to their supervisor. Any supervisor receiving such a report must inform the Coordinator.',
        'The improper disclosure must be documented in detail, including how the disclosure was allowed to happen and the extent of the disclosure.',
        'The Coordinator will be responsible for proper reporting to the Multifamily EIV Help Desk at MF_EIV@hud.gov (1-800-767-7588).',
        'The Coordinator will immediately suspend or remove the EIV access of any user involved in the incident while it is investigated.',
      ] },
    ],
  },
  {
    id: 'eiv_reports', title: 'EIV Reports', blocks: [
      { k: 'p', text: 'The following requirements apply to all EIV reports:' },
      { k: 'ul', items: [
        'No adverse action based solely on EIV. EIV data will not, by itself, be used to deny, reduce, or terminate assistance or to require repayment. Before taking any adverse action based on EIV data, management will verify the information as described in this policy, notify the tenant in writing of the results, and ask the tenant to meet with management within 10 days of the notice to discuss them. The tenant may contest the findings in the same way as any other eligibility finding.',
        'Independent third-party verification. Management will obtain written third-party verification directly from the income source, and will not rely on tenant-provided documents, when: the tenant cannot provide acceptable, current documentation; the tenant disputes the EIV data; there is an EIV income discrepancy; the EIV employment or income data is incomplete and management needs additional information (e.g., pay rate, hours, or effective date); or the tenant reports wages, unemployment, or Social Security/SSI income that does not appear in EIV. If third-party verification cannot be obtained, the reason will be documented in the tenant file. Tenant self-certification will be accepted only when no other acceptable verification method is available.',
        'Separate households. Any detail report kept in a tenant file must contain only that household’s information. When a printout includes more than one household, the pages will be separated before filing.',
        'Suspected fraud. Tenants who knowingly provided incomplete or inaccurate information will be handled in accordance with 4350.3, Chapter 8. Where fraud is suspected, management will report it to the HUD Office of Inspector General (OIG).',
      ] },
      { k: 'h', text: 'Income Information' },
      { k: 'p', text: 'Summary Report: Summary of household information from the current, active certification in the TRACS files at the time of the income match. This report will be used to make sure that each tenant’s SSN is valid and to verify the identity of each tenant.' },
      { k: 'ul', items: [
        'This report is run within 90 days after the move-in or initial certification is transmitted to TRACS, and at each recertification (Annual & Interim).',
        { text: 'The report will list the tenant’s “Identity Verification Status.” There are 4 statuses that can be reported:', sub: [
          'Verified: All information matches the SSA database. No further action is needed. A copy of the summary report will be printed and added to the tenant file for the entire period of tenancy plus three years.',
          'Failed: Information does not match the SSA database. The tenant’s identifiers (name, SSN, date of birth) will be checked and any invalid data will be fixed by submitting a correction or interim recertification with the correct information. When the Identity Verification Status changes to “verified,” a new summary report will be printed and kept in the tenant file for the entire period of tenancy plus three years. Management will collect documentation to verify identifiers. Once the identity status is “verified,” these documents can be destroyed.',
          'Not Verified: Tenant info has not yet been sent by HUD to SSA or has not yet been matched by SSA for validation. No action is taken at this time, but the “Failed SSA Identity Test” report must be checked monthly to confirm the status does not fail (see below). A copy of the summary report will be printed and added to the tenant file for the entire period of tenancy plus three years.',
          'Deceased: SSA records indicate the person is deceased. Management will follow the procedures under Deceased Tenants Report below: confirm in writing whether the person is deceased; if so, update the household composition (or process a move-out for a sole-member household) and return any overpaid subsidy to HUD; if not, check the member’s identifiers for data-entry errors, correct them in TRACS, and advise the person to contact SSA.',
        ] },
        'If a tenant is exempt from disclosing their SSN, verification of that exemption should be placed in the file. The exemptions are: (a) tenants who were 62 years of age or older as of January 31, 2010 and whose initial determination of eligibility was begun before January 31, 2010; (b) individuals who do not contend eligible immigration status. EIV has no income data for exempt individuals, so their income will be verified through third-party verification.',
        'If the Summary Report in the tenant file shows “Verified” for all household members, the report does not have to be printed out at recertification unless there is a change in household composition or in a member’s identity status.',
      ] },
      { k: 'p', text: 'Income Report: Provides employment, wage, and unemployment information from HHS’s National Directory of New Hires (NDNH), and Social Security, SSI, and Medicare information from SSA, for household members who have passed the SSA identity test. This report will be used to identify tenants who may have not reported accurate income information (or may be receiving multiple subsidies). It also serves as verification for income information.' },
      { k: 'ul', items: [
        { text: 'This report is run at recertification (Annual & Interim).', sub: [
          'If there is no dispute of the EIV information, then a copy of the report must be printed out and kept in the tenant file together with the tenant’s income verification documentation for the entire period of tenancy plus three years.',
          'If a discrepancy is found between the tenant-provided income information and the EIV report, then management must investigate the matter and obtain third-party verification as described under the general requirements above. A copy of the report, together with all correspondence and documentation collected, must be maintained for the entire period of tenancy plus three years.',
          'If it is determined that the tenant-provided information is correct, advise the tenant to ask the source of the incorrect information to correct it: in writing to the employer for wages or to the State Workforce Agency for unemployment benefits (with a copy of the letter given to management for the tenant file), or, for Social Security and SSI, by calling SSA at 1-800-772-1213 or visiting the local SSA office. If the incorrect data may be the result of identity theft, management will refer the tenant to the steps in 4350.3, Paragraph 9-16.E (check SSA records, file a complaint with the FTC, and monitor credit reports).',
          'If the EIV report information is correct, then process the certification accordingly, while explaining to the tenant the source of the discrepancy to ensure it does not happen again. If the discrepancy shows that income was unreported or under-reported on a prior certification, follow the repayment procedures under Income Discrepancy Report below.',
        ] },
        { text: 'Within 90 days after the move-in or initial certification is transmitted to TRACS. This is to confirm/validate income information provided at move-in.', sub: [
          'Any discrepancy found after move-in must be resolved within 30 days of the Income Report date. If necessary, a corrected Move-In certification will be submitted to TRACS.',
          'For every move-in and initial certification, a copy of the report must be printed out and kept in the tenant file (together with all documentation used to resolve any discrepancy, including when reported income does not show up on the report at all) for the entire term of tenancy plus three years.',
        ] },
        'For wages and unemployment benefits, the Income Report will be used as third-party verification of the tenant’s employment and/or unemployment, but the quarterly amounts shown in EIV will not be used to calculate income. Once the tenant confirms the EIV information is correct, management will calculate income using current tenant-provided documents (e.g., four current, consecutive pay stubs). Written third-party verification will be obtained from the source if the tenant disputes the EIV data, if management needs more information or has reason to reject the tenant’s documents, or if the tenant reports employment or unemployment income that is not in EIV.',
        'For Social Security and SSI benefits, once the tenant confirms the EIV information is correct, the Income Report will be used as third-party verification and to calculate income using the gross monthly benefit amount. A benefit letter is not needed unless the tenant disputes the EIV data. Medicare information is not income: the Medicare premium will be included as a medical expense when it is paid by the tenant (an “N” in the Buy-in column, or, if the report shows “Y” and the tenant disputes it, current documentation showing the tenant pays the premium). Because EIV does not show other deductions (e.g., Medicare Part D premiums or garnishments), management will ask the tenant about them. The SSA disability status shown in EIV will not be used to determine whether a person is disabled for eligibility or for the elderly/disabled household allowance.',
        'For recertifications effective January 1 through April 1, when EIV does not yet show the SSA cost-of-living adjustment (COLA), management will use one of these methods: (1) use the EIV benefit amount without the COLA, if the tenant confirms it is what he/she is receiving; (2) use an SSA benefit or award letter or Proof of Income Letter that includes the COLA and is dated within 120 days of receipt; (3) apply the COLA percentage to the current verified benefit and document the calculation; or (4) request third-party verification from SSA when the tenant’s reported income does not match EIV. Recertifications effective after April 1 must reflect the benefit including the COLA.',
        { text: 'If a tenant disputes the EIV Social Security or SSI information, they must provide 3rd-party verification such as their SSA benefit or award letter or a Proof of Income Letter dated within 120 days of the date management receives it. A bank statement shows only the net deposit and will not be used by itself to establish the gross benefit. Management will not send the tenant to the SSA office; the tenant can request a Proof of Income Letter through SSA’s website (www.ssa.gov) or by calling 1-800-772-1213. The verified benefit amount will then be used, and the Income Report should be annotated “Tenant Disputed – Award Letter Used Instead.” Both the Income Report and 3rd-party verification must be kept in the tenant file.', sub: [
          'Management will advise the tenant to contact the Social Security Administration to request the incorrect information be corrected.',
        ] },
      ] },
      { k: 'p', text: 'Income Discrepancy Report: Used to identify households where there is a discrepancy in the income reported in TRACS and the various government databases of $2,400 or more per year in wages, unemployment, and/or Social Security and SSI benefits. The report identifies income that may have been under-reported (negative amounts) or over-reported (positive amounts); both must be investigated.' },
      { k: 'ul', items: [
        'This report is run and printed at the same time as the Income Report (Annual & Interim, and within 90 days of move-in), because EIV regenerates the report each week and overwrites the prior version.',
        'Some properties choose to run this report more often — see the EIV Schedule for this property’s schedule and filing policy.',
        'Any discrepancy must be reviewed and resolved at the time of the recertification or within 30 days of the EIV Income Report date.',
        'This report is printed out together with the Income Report and filed in the tenant file together with it. All documentation collected to resolve the discrepancy must be included in the file as well, retained for the entire term of tenancy plus three years.',
        'A report/documentation must be filed regardless of whether the discrepancy is valid or invalid.',
        'Before treating a discrepancy as valid, management will confirm that the information in TRACS agrees with the HUD-50059 in the tenant file (and retransmit the current HUD-50059 if it does not), determine whether the income is excluded income (4350.3, Exhibit 5-1), and consider timing differences (e.g., income earned before move-in). Management is not expected to reconcile amounts to the penny.',
        'If the discrepancy shows that income was over-reported and the tenant was overcharged, management will correct the affected certification(s) and reimburse the tenant in accordance with 4350.3, Chapter 8.',
        'If it is determined that a tenant under-reported income on a previous certification, then a correction to prior certifications must be made (going back to the date the under-reporting began, but no more than five years, as authorized by forms HUD-9887 and HUD-9887-A; repayment may be sought only for periods for which the HUD-50059s are on file). Management will notify the tenant in writing of the amount owed (the difference between the rent that should have been paid and the rent charged), give the tenant a copy of the calculation, and keep a copy in the tenant file. The tenant will be responsible for repaying the full amount to the owner, in a lump sum within 30 days, under a repayment agreement, or a combination of both (see below). Failing to report income accurately, or refusing to repay, constitutes non-compliance with the lease, and the tenant may be subject to termination of tenancy. These procedures also apply to unreported income identified through any other EIV report (e.g., the New Hires Report). Subsidy paid while a tenant was receiving multiple subsidies is repaid to HUD as described under Multiple Subsidy Report.',
        { text: 'The tenant can repay the amount owed as a lump sum, through a repayment agreement, or a combination of both:', sub: [
          'Repayment Agreement: If the amount is more than the tenant can pay, management may enter into a repayment agreement with the tenant. (After the prior certifications are corrected, HUD will pay the owner/manager up front the total amount the tenant owes, and the tenant will make monthly payments to the property, which are passed along to HUD on the voucher, less any collection costs.)',
          'The monthly repayment amount plus the family’s Total Tenant Payment (TTP) at the time the agreement is signed should not exceed 40% of the family’s monthly adjusted income. The monthly payment may exceed 40% if the family agrees to that amount in the agreement.',
        ] },
        { text: 'The repayment agreement must:', sub: [
          'Include the total retroactive rent amount owed by the tenant, any lump-sum amount the tenant pays at the signing of the agreement (if applicable), and the monthly payment amount.',
          'Reference the specific lease language noting that the tenant is in non-compliance and may be subject to lease termination.',
          'Include a clause stating that the terms of the agreement will be renegotiated if the family’s income increases or decreases $200 a month or more.',
          'Include a statement that the monthly rent repayment amount is in addition to the family’s monthly rent payment and is payable to the owner.',
          'Include a statement that late or missed payments constitute default of the repayment agreement and may result in termination of subsidy and/or tenancy.',
          'Be signed and dated by the tenant and the owner/manager. HUD recommends that the head of household and, if applicable, the family member who had the unreported or under-reported income sign the agreement.',
        ] },
        { text: 'HUD allows owner/manager to retain a portion of the repayment to help defray the cost of pursuing these cases. The amount retained is the lesser of the actual cost or 20% of the amount received from the tenant. Management must keep a record of:', sub: [
          'Date and amount received from the tenant.',
          'Expenses incurred, including staff time for verifying unreported income, meeting with the tenant, drafting the agreement, collecting the payments, processing the voucher, and collection agency fees.',
          'Amount retained.',
          'Voucher date(s) and amount(s) remitted to HUD.',
        ] },
        'All adjustments and repayments will be processed together with the monthly voucher.',
        'Management will not apply the tenant’s monthly rent payment toward the repayment amount. The repayment is in addition to the monthly rent.',
        'If a tenant moves out still owing HUD money on the repayment agreement (i.e., if HUD gave the property the amount the tenant owes, and management forwards tenant payments to HUD — see Repayment Agreement above), the tenant will be given a letter notifying them of their balance with instructions to continue paying the balance to the property, which will pass the payments along to HUD on the voucher.',
        'If the overpayment of subsidy was caused solely by management’s failure to follow HUD’s procedures (e.g., failure to verify income), the tenant is not required to repay it, and the owner must reimburse HUD for the overpaid assistance.',
      ] },
      { k: 'p', text: 'No Income Report: Identifies tenants who have no income reported. There are two No Income Reports: (1) No Income Reported on 50059 — lists tenants who passed the SSA identity test and reported zero income on their last HUD-50059; (2) No Income Reported by HHS or SSA — lists tenants who passed the SSA identity test but for whom no employment or income information was returned from the HHS (NDNH) or SSA databases.' },
      { k: 'ul', items: [
        'The purpose of these reports is to allow managers to monitor zero-income tenants and to confirm that they in fact have zero source of income. In addition, if a known zero-income tenant is not showing up on the “No Income Reported by HHS or SSA” list, either EIV has income information for that tenant (e.g., new employment or Social Security) or the tenant has not passed the SSA identity test; management will review the tenant’s Income Report and identity verification status.',
        'Tenants with zero income will need to fill out an affidavit of zero income.',
        'At Section 8 properties, every tenant must pay a minimum of $25 rent (the minimum Total Tenant Payment) even if they are zero income, unless they qualify for a hardship exemption.',
        { text: 'Should the resident request a minimum rent hardship exemption, they should be asked questions regarding their spending to confirm that they in fact have no income. Questions include:', sub: [
          'How does the tenant receive basic provisions such as food and clothing?',
          'How does the tenant pay for vehicles and/or other amenities?',
          'If previously employed, is the tenant receiving unemployment or a pension?',
          'Does the tenant expect to resume working, and when?',
        ] },
        'Zero-income households that request a minimum rent hardship exemption will be re-verified at least every 90 days, including a review of the household’s EIV Income Report to determine whether any member has income reported by HHS or SSA, an updated zero-income certification, and responses to the questions above. This documentation will be kept in the tenant file for the term of tenancy plus three years.',
        'This report is not required at a set schedule, but it is good practice to run it at least quarterly. See the EIV Schedule for this property’s schedule.',
        'It is not necessary to print and file these reports; some properties may choose to. See the EIV Schedule for this property’s filing policy.',
      ] },
      { k: 'p', text: 'New Hires Report (Summary & Detail): Identifies tenants who have new employment within the last 6 months. (Accessible under the Income Reports or under Verification Reports.)' },
      { k: 'ul', items: [
        'Management will contact each tenant on the report who has not already reported the new employment to confirm the employment information. If the tenant does not dispute the new hire, then they must provide current documentation of the new income (e.g., four current, consecutive pay stubs or an employer’s letter); if needed, management will obtain written third-party verification from the employer. If the tenant disputes the report, then verification must be obtained from the source of the disputed income.',
        'If the change meets the interim reporting requirement in the lease and house rules (a cumulative increase of $200 or more per month), process an Interim Recertification (IR) to account for the new income. If the tenant did not report the increase on time, the rent increase will be applied retroactively, without a 30-day notice, in accordance with 4350.3, Chapter 7. Any amount owed will be handled under the repayment procedures in the Income Discrepancy Report section.',
        'The New Hires Reports must be run at least quarterly. Some properties choose to run this report more often. See the EIV Schedule for this property’s schedule and filing policy.',
        'The New Hires Summary Reports must be printed and maintained in the “New Hires Report Master File” for a period of 3 years. Each tenant’s New Hires Detail Report must be saved in that tenant’s file (together with all correspondence, verifications, and certifications) for the entire term of tenancy plus three years.',
        'Sometimes a tenant will remain on the report even after the income has been included on a HUD-50059. The manager will note this on the report (e.g., “Income included on the [date] certification”).',
      ] },
      { k: 'h', text: 'Verification Reports' },
      { k: 'p', text: 'Existing Tenant Search: Identifies applicants who may be receiving rental assistance at another multi-family or Public Housing location.' },
      { k: 'ul', items: [
        'This report is run for each member of the household (including minors) at the time the application is processed for admission (i.e., when the applicant is screened for move-in, before a unit is offered). This requirement is also included in the property’s Tenant Selection Plan. It will also be run for existing tenants if they are having an initial certification.',
        'If an applicant is found to be receiving assistance at a different location, management must discuss the circumstances of that assistance to avoid having the tenant receive a double subsidy. The other location must be contacted to verify the assistance and to arrange the move-out date from the current location and the move-in date to the new one. A copy of all correspondence must be kept.',
        'Management will not move in a tenant currently receiving subsidy at another location until they have written confirmation from the other location that the tenant has moved out.',
        'A copy of the report (as well as all correspondence, documentation, and verification) must be kept in the tenant file for the entire term of tenancy plus three years. If the applicant does not end up moving in, the report (as well as all correspondence, documentation, and verification) must be retained together with the application for three years.',
      ] },
      { k: 'p', text: 'Multiple Subsidy Report (Summary and Detail): Identifies tenants who may be receiving rental assistance at more than one location.' },
      { k: 'ul', items: [
        'This report must be run at least quarterly. Some properties choose to run this report more often. See the EIV Schedule for this property’s schedule and filing policy.',
        'The report will be run for all household members, using both searches: within Multifamily Housing and within Public and Indian Housing (PIH).',
        'If a tenant is found to be receiving multiple subsidy, management will discuss the circumstances with them. The other location will be contacted to determine the correct location to receive the subsidy.',
        'If, after investigation, a tenant is confirmed to be receiving multiple subsidies, action will be taken in accordance with 4350.3, Chapter 8, including termination of subsidy and possible eviction for violation of the lease. Any undue subsidy must be repaid to HUD.',
        'A tenant in a partially subsidized property (e.g., a Section 236 unit) who receives Housing Choice Voucher assistance may appear on this report but is not receiving double subsidy. Management will print the report and note that the tenant has a Housing Choice Voucher.',
        'If a child is found to be living at multiple locations because of split custody, it must be determined how the childcare expenses (if any) are being claimed. Childcare expenses can be split between the two households when the custody and expense are documented for each household and the documentation demonstrates that the total expense claimed does not exceed the cost for the actual time the child spends in care.',
        'The Multiple Subsidy Report must be printed and maintained in the “Multiple Subsidy Report Master File” for a period of 3 years. Each tenant’s Multiple Subsidy Detail Report must be saved in that tenant’s file (together with all correspondence, verifications, and certifications) for the entire term of tenancy plus three years.',
      ] },
      { k: 'h', text: 'Identity Verification Reports' },
      { k: 'p', text: 'There are three Identity Verification Reports.' },
      { k: 'p', text: 'Failed EIV Pre-Screening Report: Identifies tenants who fail EIV because of invalid or missing personal identifiers such as SSN, Last Name, or Date of Birth. It also reports which tenants have a current certification date more than 15 months old.' },
      { k: 'ul', items: [
        'This report must be run monthly.',
        'Missing info must be entered and incorrect info corrected in TRACS within 30 days of the date of the report. If the last certification is more than 15 months old, a new certification must be transmitted.',
        'Before contacting the tenant, management will check for data-entry errors (e.g., transposed SSN digits). Members with TRACS-generated ID numbers will be asked to disclose an SSN when required. EIV has no income data for members who appear on this report, so their income will be verified through third-party verification.',
        'The Failed EIV Pre-Screening Report must be printed and retained in a “Failed EIV Pre-Screening Master File” for 3 years. Tenant correspondence, verifications, and certifications related to the report must be retained in the tenant file for the entire term of tenancy plus 3 years.',
        'If a tenant is exempt from providing an SSN, they will still come up on this report. Make a notation on the report that the tenant is exempt.',
        'If tenant information was corrected at recertification but the EIV data has not yet been updated, this should be noted on the report.',
      ] },
      { k: 'p', text: 'Failed Verification Report (Failed the SSA Identity Test): Identifies tenants whose personal identifiers (SSN, Last Name, Date of Birth) do not match the SSA database. It also reports deceased tenants.' },
      { k: 'ul', items: [
        'This report must be run monthly.',
        'Management must follow up with tenants to verify their information and make the necessary corrections to certifications in TRACS within 30 days of the date of the report (after first checking for data-entry errors). If there is a mistake in the SSA system, the tenant should be advised to contact the SSA. A copy of form SS-5 (Application for a Social Security Card) will be provided upon request.',
        'The Failed Verification Report must be printed and retained in a “Failed Verification Report Master File” for 3 years. Tenant correspondence, verifications, and certifications related to the report must be retained in the tenant file for the entire term of tenancy plus 3 years.',
        'If tenant information was corrected at recertification but the EIV data has not yet been updated, this should be noted on the report.',
      ] },
      { k: 'p', text: 'Number of Households Not Verified: Identifies households that are in the process of being verified. This report is not required to be run or filed; it is a tool provided to owners as a courtesy.' },
      { k: 'p', text: 'Deceased Tenants Report: Identifies tenants reported deceased by the SSA.' },
      { k: 'ul', items: [
        'This report must be run at least quarterly. Some properties choose to run this report more often. See the EIV Schedule for this property’s schedule and filing policy.',
        'Management must confirm, in writing, with the head of household, next of kin, or the contact person/entity provided by the tenant (e.g., on form HUD-92006), whether the tenant is in fact deceased.',
        'Management will also check the member’s identifiers in TRACS for data-entry errors (e.g., an incorrect SSN that belongs to a deceased person).',
        'If the tenant is deceased, the manager will update the family composition and any related income/assets/expenses within 30 days of the report. Any overpayment of subsidy must be returned to HUD.',
        'If the deceased tenant was the sole occupant of the unit, a move-out certification must be processed with the effective date being the earlier of (a) 14 days after the tenant’s death or (b) the date the unit was vacated.',
        'If the person is not deceased, management will encourage the tenant to contact the SSA to correct the information.',
        'The Deceased Tenant Report must be printed and retained in a “Deceased Tenant Report Master File” for 3 years. Tenant correspondence, verifications, and certifications related to the report must be retained in the tenant file for the entire term of tenancy plus 3 years.',
        'If the tenant was already removed but is still showing up on the report because EIV was not yet updated, this should be noted on the report.',
      ] },
    ],
  },
  {
    id: 'eiv_schedule', title: 'EIV Schedule', blocks: [
      { k: 'p', text: 'The following is this property’s EIV report schedule and filing policy.' },
      { k: 'schedule' },
    ],
  },
]
