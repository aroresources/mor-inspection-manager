// EIV Policy & Procedure — master template (Layer 1).
//
// Fixed HUD boilerplate lives here as structured sections. Variable parts are:
//   - {{mergeKey}} tokens  -> filled from entity merge fields (name/address/phone/company)
//   - the Security storage sentence -> optional "be more specific" detail
//   - the EIV Schedule     -> per-property frequency (quarterly ▸ monthly) + filing
//   - an optional staff roster (names), off by default
// Everything defaults to generic language; nothing requires input.

export type ListItem = string | { text: string; sub?: ListItem[] }
export type Block =
  | { k: 'p'; text: string }
  | { k: 'h'; text: string }
  | { k: 'ul'; items: ListItem[] }
  | { k: 'schedule' }
  | { k: 'roster' }
export interface Section { id: string; title: string; blocks: Block[] }

export interface RosterEntry { name: string; role: string }
export interface ScheduleChoice { frequency?: 'Quarterly' | 'Monthly'; file?: boolean; include?: boolean }
export interface EivSettings {
  merge?: Record<string, string>
  roster?: RosterEntry[]
  storageDetail?: string
  schedule?: Record<string, ScheduleChoice>
}

export const EIV_MERGE_FIELDS = [
  { key: 'sitename', label: 'Property name', entity: true },
  { key: 'address', label: 'Property address', entity: true },
  { key: 'phone', label: 'Property phone', entity: true },
  { key: 'company', label: 'Management company', entity: true },
]

export const EIV_ROLES = ['Owner/Manager', 'EIV Coordinator', 'EIV User', 'EIV Non-User', 'Other']

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
  { key: 'income_summary', report: 'Income Summary Report', freq: 'MI (within 90 days), AR, IR', fileText: 'Tenant file, with supporting docs', fixed: true },
  { key: 'income_report', report: 'Income Report', freq: 'MI (within 90 days), AR, IR', fileText: 'Tenant file, with the applicable 50059', fixed: true },
  { key: 'income_discrepancy', report: 'Income Discrepancy Report', freq: 'MI (within 90 days), AR, IR', fileText: 'Tenant file, with supporting docs', fixed: true },
  { key: 'no_income_50059', report: 'No Income Reported on 50059', freq: 'Quarterly', monthlyOption: true, fileText: 'Not required', fileOption: true },
  { key: 'no_income_hhs_ssa', report: 'No Income Reported by HHS or SSA', freq: 'Quarterly', monthlyOption: true, fileText: 'Not required', fileOption: true },
  { key: 'new_hires', report: 'New Hires Report', freq: 'Quarterly', monthlyOption: true, fileText: 'Summary → New Hires Report Master File; Detail → tenant file, with supporting docs' },
  { group: 'Verification Reports' },
  { key: 'existing_tenant', report: 'Existing Tenant Search', freq: 'Upon application', fixed: true, fileText: 'If admitted → tenant file, with supporting docs; if not admitted → kept with the application' },
  { key: 'multiple_subsidy', report: 'Multiple Subsidy', freq: 'Quarterly', monthlyOption: true, fileText: 'Summary → Multiple Subsidy Master File; Detail → tenant file, with supporting docs' },
  { key: 'deceased', report: 'Deceased Tenant Report', freq: 'Quarterly', monthlyOption: true, fileText: 'Summary → Deceased Tenant Report Master File; docs → tenant file' },
  { group: 'Identity Verification Reports' },
  { key: 'failed_prescreen', report: 'Failed EIV Pre-Screening Report', freq: 'Monthly', fixed: true, fileText: 'Failed EIV Pre-Screening Master File; docs → tenant file' },
  { key: 'failed_verification', report: 'Failed Verification Report', freq: 'Monthly', fixed: true, fileText: 'Failed Verification Master File; docs → tenant file' },
  { key: 'not_verified', report: 'Number of Households Not-Verified', freq: 'Optional', optIn: true, fileText: 'Not required' },
]

// Effective frequency for a schedule row given the property's choices.
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
      { k: 'p', text: 'The Enterprise Income Verification System, or EIV, is mandatory as of 1/31/10. All recertifications with an effective date of 6/1/10 or later must reflect EIV use. EIV is a way for O/A’s to verify an applicant or tenant’s income in order to determine eligibility in affordable housing programs.' },
      { k: 'p', text: 'As per HUD Guidelines, Owner/Agents must have written policies & procedures for staff to follow to ensure that applicants and tenants are treated fairly and are not being discriminated against.' },
      { k: 'p', text: 'It is critical that all EIV users become familiar with these policies and procedures as well as with each report, how often it must be used, and what actions are required. HUD Notice H 2010-10, issued on July 1, 2010, set down the requirements for EIV and is updated by HUD on occasion. These Policies & Procedures will be updated accordingly.' },
      { k: 'p', text: 'Be Advised: On your MOR, the reviewer will make sure you have written EIV policies and procedures in place, an EIV file containing all required items, and that you are using EIV and using it correctly. Your reviewer will also check security procedures to ensure that you are following HUD-required procedures for security.' },
    ],
  },
  {
    id: 'privacy', title: 'Privacy', blocks: [
      { k: 'p', text: 'When using information from EIV, tenant data will only be used:' },
      { k: 'ul', items: [
        'As a third-party source to verify tenant employment and income to determine a household’s eligibility for participation in the property’s HUD rental assistance program;',
        'As a third-party source to verify tenant employment and income to determine the level of assistance that the household is entitled to receive;',
        'To identify and correct prior subsidy overpayments and/or underpayments;',
        'For administrative monitoring/quality control during supervision/training of employees who perform tenant certifications; and',
        'To determine whether an applicant or current tenant is currently living in another HUD-assisted property.',
      ] },
      { k: 'p', text: 'The data will not be disclosed in any way that would violate the privacy of the individuals whose data is included in the system.' },
      { k: 'p', text: 'During the certification interviews, each tenant will be provided with visual access to records pertaining to him/herself and an opportunity to dispute the contents of the records.' },
      { k: 'p', text: 'A tenant may request assistance during his/her certification interview. In this case, s/he must sign a release allowing the person(s) assisting (i.e. Service Coordinator, relative, social worker, translator) to view his/her EIV data during the interview process.' },
      { k: 'p', text: 'Management cannot provide copies of any EIV data to any third party, even upon tenant request. However, the tenant may request his/her own EIV data from management. A record showing which EIV data was released to the tenant will be signed and dated by both the tenant and management and kept in the tenant file. Security of this data then becomes the tenant’s responsibility.' },
    ],
  },
  {
    id: 'staff_roles', title: 'Staff Roles', blocks: [
      { k: 'p', text: 'The following are the roles in the company and their responsibilities as they pertain to EIV:' },
      { k: 'roster' },
      { k: 'h', text: 'Owner/Manager' },
      { k: 'ul', items: [
        'Authorize EIV Coordinators (see below).',
        'Provide final oversight over the staff, especially the EIV Coordinator.',
      ] },
      { k: 'h', text: 'EIV Coordinator(s)' },
      { k: 'ul', items: [
        'Maintain an initial Coordinator Access Authorization Form (CAAF) and recertify annually; pass the Cyber Security Awareness Test annually.',
        'Assign access rights to EIV users appropriately, based on their job responsibility.',
        'Oversee EIV use in the company, staying up to date with any changes, and in general make sure that all regulations are being followed. This includes making sure that all authorized Users are using EIV data in accordance with HUD regulations, that they are appropriately safeguarding EIV information, and that all users receive EIV training, including security training, prior to using EIV and again at least annually.',
        'Ensure that each EIV user has their paperwork up to date, including their initial User Access Authorization Form (UAAF), bi-annual UAAF, and Cyber Security Awareness Certificate.',
        'Ensure that any non-user who needs to view EIV reports signs a Rules of Behavior (for Individuals without Access to the EIV System).',
        'Ensure that no one has unauthorized access to EIV, including the removal of employees who are no longer working for the company.',
      ] },
      { k: 'h', text: 'EIV Users' },
      { k: 'ul', items: [
        'Maintain an initial User Access Authorization Form (UAAF), bi-annual UAAF, TRACS & EIV Rules of Behavior, and pass the Cyber Security Awareness Test annually.',
        'Run, use, and file the EIV reports in accordance with HUD regulations, this Policy & Procedure manual, and company policy.',
      ] },
      { k: 'h', text: 'EIV Non-Users' },
      { k: 'ul', items: [
        'Sign the Rules of Behavior for Use of Enterprise Income Verification (EIV) Information (for Individuals without Access to the EIV System).',
        'Pass the Cyber Security Awareness Test annually.',
      ] },
    ],
  },
  {
    id: 'disclosure', title: 'Disclosure to Tenants', blocks: [
      { k: 'ul', items: [
        'At Move-In, and at each subsequent certification, each adult applicant/tenant will be asked to sign the HUD-9887 and HUD-9887A.',
        'The HUD-9887, Notice and Consent for the Release of Information, authorizes the owner/manager and HUD (among other government agencies) to provide and share income information with each other.',
        'The HUD-9887A, Applicant’s/Tenant’s Consent to the Release of Information, authorizes the owner/manager to request information from a third party about you.',
        'A copy of the signed HUD-9887/A will be provided to each adult applicant/tenant.',
        'Details of the disclosure can be found on the HUD-9887/A Fact Sheet, which will also be provided when the 9887/A is signed.',
        'The original signed 9887/A will be kept in the tenant file together with the tenant certification.',
        'If a disability prevents an applicant/tenant from being able to read or understand the forms, a reasonable accommodation will be made.',
        'At Move-In, and at each subsequent certification, a copy of the “EIV and You” brochure will be given to each applicant/tenant.',
      ] },
    ],
  },
  {
    id: 'security', title: 'Security', blocks: [
      { k: 'p', text: 'EIV information will be kept confidential and will only be used for HUD-approved purposes.' },
      { k: 'p', text: 'All EIV data is subject to the provisions of the Federal Privacy Act of 1974 (5 U.S.C. § 552a) as well as any State and local privacy laws. HUD, owner/manager, and the PHA may be subject to penalties for unauthorized disclosures or improper uses of the income information.' },
      { k: 'p', text: 'Owner/manager will protect the EIV data at all times by the following procedures:' },
      { k: 'h', text: 'Technical Safeguards' },
      { k: 'ul', items: [
        'Each individual with EIV access must have and use their own WASS ID and password. These IDs and passwords cannot be shared.',
        'Coordinators will be recertified annually (by HUD) and Users bi-annually (by the Coordinator) to ensure that no unauthorized users have access.',
        'Coordinators and Users will take the Department of Defense Cyber Security Challenge and pass the test annually.',
        'Coordinators will monitor EIV access and use to make sure that each user has a legitimate need to use the EIV system, and make modifications to access if there is a change in employment or job responsibility. New users will not be given access until they have trained properly.',
      ] },
      { k: 'h', text: 'Administrative Safeguards' },
      { k: 'ul', items: [
        'Maintain and follow a written Policy & Procedure for the use of EIV at the property.',
        'Twice a year, the EIV Coordinator will review User IDs to make sure that no unauthorized user has access.',
        'All EIV Coordinators and Users will be trained either through in-house training by the compliance team, or external training classes offered by various industry experts, or a combination of both.',
        'Initial training will be completed before access to EIV is approved. This training will include a detailed review of EIV rules and regulations as well as a review of these Policies & Procedures.',
        'Annual training will include a review of EIV rules & regulations, these Policies & Procedures, and a review of any changes to the above. Each User’s work will be evaluated in detail to ensure that they are complying with all the above.',
        'All non-Users with access to EIV data will be required to undergo training initially and annually as well. This training will focus on permitted uses of EIV data as well as security.',
        'A log of all EIV training will be maintained, as well as a schedule for all future trainings.',
        'Form HUD-9887/A must be signed by the adult applicant/household member (except for live-in aides), and be present in the tenant file, in order for Income Report(s) to be run/used.',
        'A signed 9887/A is not required for access or use of the Existing Tenant Search at the time of application and/or tenant screening.',
        { text: 'When a household member turns 18 years old they must report to management within 60 days or by the time of the next recertification (whichever is first) and sign a HUD-9887/A so that income reports can be run for them.', sub: [
          'Failure to report and sign within this timeframe will constitute a lease non-compliance, and the household subsidy/tenancy may be terminated. This notification requirement will be part of the house rules.',
          'Management will provide written notice of this requirement to each household with a 17-year-old member, at the time of any Annual or Interim certification.',
        ] },
      ] },
      { k: 'h', text: 'Physical Safeguards' },
      { k: 'p', text: 'The following applies to all printed reports:' },
      { k: 'ul', items: [
        'They will immediately be removed from printer trays and will not be left unattended at any time.',
        'They will not be viewed within viewing distance of unauthorized personnel or visitors.',
        'When not in use, they will immediately be placed in the appropriate file/folder, which will be placed in a [[storage]]. Only authorized EIV users may be given keys and/or access to files containing EIV data.',
        'The EIV data of an adult household member will not be shared with (i.e. no copies will be provided, nor will the printout be displayed to) another adult household member, or to anyone assisting the tenant during the recertification process or interview, unless the individual has provided written consent to disclose the EIV information. Note: HUD allows management to show and discuss with the Head of Household how the family’s income and rent were determined, based on the total income reported and verified.',
        'EIV data displayed on computer monitors will only be active when the information is being utilized, and only when no unauthorized persons are within viewing distance.',
        'Electronically stored EIV data on in-office hard drives will be stored only in restricted-access, password-protected directories. EIV data on portable media must be labeled “Confidential” or “For Official Use Only” and encrypted using an industry-standard security system. Independent Public Auditors are not permitted to download any EIV data.',
        'All emails that contain EIV data must be encrypted. The full 9-digit Social Security number for a tenant will not be included in emails or other electronic communications.',
        'When faxing EIV data, the user must ensure that the person receiving the fax is waiting and ready to retrieve it as soon as it is printed.',
        { text: 'Any Independent Public Auditor (IPA) hired by the owner to perform a financial audit of the property and to determine the owner’s compliance with income verification requirements and accuracy of rent and subsidy calculation is subject to the following restrictions:', sub: [
          'Can only access EIV income information in hard-copy files, and only inside property offices.',
          'Cannot transmit or transport EIV income information in any form.',
          'Cannot enter or download EIV data to any mobile device or portable media.',
          'Must sign the Rules of Behavior for Non-System Users and abide by its non-disclosure oaths.',
          'Cannot duplicate any EIV income information or re-disclose it to any unauthorized individual.',
        ] },
        'Users will properly log out of the EIV system whenever they leave their computers.',
        'No EIV data will be shared or co-mingled in files for other programs (such as LIHTC, rural housing, etc.) that are subject to file inspections from agencies other than HUD, unless and until such time as HUD/HHS authorizes this.',
        'If printed EIV data needs to be disposed of, it will be done in a way that will ensure it is destroyed permanently (such as by shredding, burning, or pulverizing). If electronic EIV data needs to be disposed of, it will be done in a way that will ensure it is destroyed permanently (delete, recycle bin, file shredder, etc.).',
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
        'Any employee who detects improper disclosure of, unauthorized access to, or security breaches involving EIV data must report them to the EIV Coordinator or to their supervisor. Any supervisor receiving such a report must inform the Coordinator.',
        'The improper disclosure must be documented in detail, including how the disclosure was allowed to happen and the extent of the disclosure.',
        'The Coordinator will be responsible for proper reporting to the HUD National Help Desk at MF_EIV@hud.gov.',
      ] },
    ],
  },
  {
    id: 'eiv_reports', title: 'EIV Reports', blocks: [
      { k: 'h', text: 'Income Information' },
      { k: 'p', text: 'Summary Report: Summary of household information from the current, active certification in the TRACS files at the time of the income match. This report will be used to make sure that each tenant’s SSN is valid and to verify the identity of each tenant.' },
      { k: 'ul', items: [
        'This report is run 90 days after move-in, and at recertification (Annual & Interim).',
        { text: 'The report will list the tenant’s “Identity Verification Status.” There are 4 statuses that can be reported:', sub: [
          'Verified: All information matches the SSA database. No further action is needed. A copy of the summary report will be printed and added to the tenant file for the entire period of tenancy plus three years.',
          'Failed: Information does not match the SSA database. The tenant’s identifiers (name, SSN, date of birth) will be checked and any invalid data will be fixed by submitting a correction or interim recertification with the correct information. When the status changes to “verified,” a new summary report will be printed and kept in the tenant file for the entire period of tenancy plus three years. Management will collect documentation to verify identifiers; once the identity status is “verified,” these documents can be destroyed.',
          'Not Verified: Tenant info has not yet been sent by HUD to SSA or has not yet been matched by SSA for validation. No action is taken at this time, but the “Failed SSA Identity Test” report must be checked monthly to confirm the status does not fail. A copy of the summary report will be printed and added to the tenant file for the entire period of tenancy plus three years.',
          'Deceased: SSA records indicate the person is deceased. The tenant’s identifiers will be checked and any invalid data corrected via a correction or interim recertification. When the status changes to “verified,” a new summary report will be printed and kept in the tenant file. Once verified, identifier documents can be destroyed.',
        ] },
        'If a tenant is exempt from disclosing their SSN, verification of that exemption should be placed in the file. Examples are: (a) tenants who were 62 years of age or older as of January 31, 2010 and whose initial determination of eligibility began before January 31, 2010; (b) individuals who do not contend eligible immigration status.',
        'If the Summary Report in the tenant file shows “Verified” for all household members, the report does not have to be printed out at recertification unless there is a change in household composition or in a member’s identity status.',
      ] },
      { k: 'p', text: 'Income Report: Provides employment information reported by HHS and SSA. This report is used to identify tenants who may have not reported accurate income information (or may be receiving multiple subsidies). It also serves as verification for income information.' },
      { k: 'ul', items: [
        { text: 'This report is run at recertification (Annual & Interim).', sub: [
          'If there is no dispute of the EIV information, a copy of the report should be printed and kept in the tenant file together with the tenant’s income verification documentation for the entire period of tenancy plus three years.',
          'If a discrepancy is found between the tenant-provided income information and the EIV report, management must investigate the matter. A copy of the report, together with all correspondence and documentation collected, must be maintained for the entire period of tenancy plus three years.',
          'If it is determined that the tenant-provided information is correct, advise the tenant to inform their employer that their income information is being reported incorrectly.',
          'If the EIV report information is correct, process the certification accordingly while explaining to the tenant the source of the discrepancy to ensure it does not happen again.',
        ] },
        { text: 'Within 90 days after the move-in is reported to TRACS. This is to confirm/validate income information provided at move-in.', sub: [
          'Any discrepancy found after move-in must be resolved within 30 days. If necessary, a corrected Move-In certification will be submitted to TRACS.',
          'In the case of a discrepancy (including if the income does not show up on the report at all), a copy of the report should be printed and kept in the tenant file (together with all documentation used to resolve the discrepancy) for the entire term of tenancy plus three years.',
        ] },
        'For regular income, the report will only be used as a verification for the information provided by the tenant. The income information provided by the tenant must first be verified by third-party verification (see HUD 4350.3 5-12 for verification requirements).',
        { text: 'For Social Security, SSI, and Medicare income, the EIV report will be used as the sole verification.', sub: [
          'If a tenant disputes the EIV Social Security, SSI, or Medicare income information, they must provide 3rd-party verification such as their award letter or bank statement. The tenant’s information should then be used, and the Income Report should be annotated “Tenant Disputed – Award Letter Used Instead.” Both the Income Report and 3rd-party verification must be kept in the tenant file.',
          'Management will advise the tenant to contact the Social Security Administration to request the incorrect information be corrected.',
        ] },
      ] },
      { k: 'p', text: 'Income Discrepancy Report: Used to identify households where there is a discrepancy in the income reported in TRACS and the various government databases of $2,400 or more.' },
      { k: 'ul', items: [
        'This report is run at the same time as the Income Report (Annual & Interim, and within 90 days of move-in). Some properties choose to run this report more often — see the EIV Schedule for this property’s schedule and filing policy.',
        'Any discrepancy must be reviewed and resolved at the time of the recertification or within 30 days of the EIV Income Report date.',
        'This report is printed out together with the Income Report and filed in the tenant file together with it. All documentation collected to resolve the discrepancy must be included in the file as well, retained for the entire term of tenancy plus three years.',
        'A report/documentation must be filed regardless of whether the discrepancy is valid or invalid.',
        { text: 'If it is determined that a tenant under-reported income on a previous certification, then a correction to prior certifications must be made (going back up to five years). The total subsidy overpayment will be refunded to HUD and the tenant will be responsible to pay it in full within 30 days. This constitutes a non-compliance of the lease and the tenant may be subject to lease termination.', sub: [
          'The tenant can pay the overpayment back as a lump sum, or partially together with a Repayment Agreement.',
          'Repayment Agreement: If the amount is more than the tenant can pay, management/HUD may enter into a repayment agreement with the tenant. (Often, HUD will pay the owner/manager up front the total amount the tenant owes, and the tenant will make monthly payments to HUD through the voucher.)',
          'The total tenant payment (tenant rent + the repayment amount) cannot exceed 40% of their monthly adjusted income.',
        ] },
        { text: 'The repayment agreement must:', sub: [
          'Include the total amount owed by the tenant to HUD, any lump-sum amount the tenant pays at signing (if applicable), and the monthly payment amount.',
          'Reference the specific lease language noting that the tenant is in non-compliance and may be subject to lease termination.',
          'Include a closing clause stating that the terms of the agreement can be renegotiated if the family’s income increases or decreases $200 a month or more.',
          'Include a statement that the monthly rent repayment amount is in addition to the family’s monthly rent payment and is payable to the owner.',
          'Include a statement that late or missed payments constitute default of the repayment agreement and may result in termination of subsidy and/or tenancy.',
          'Be signed by the tenant and the owner/manager.',
        ] },
        { text: 'HUD allows owner/manager to retain a portion of the repayment to help defray the cost of pursuing these cases. The amount retained is the lesser of the actual cost or 20% of the amount received from the tenant. Management must keep a record of:', sub: [
          'Date and amount received from the tenant.',
          'Expenses incurred, including staff time for verifying unreported income, meeting with the tenant, drafting the agreement, collecting the payments, processing the voucher, and collection agency fees.',
          'Amount retained.',
          'Voucher dates of repayment activities.',
        ] },
        'All adjustments and repayments will be processed together with the monthly voucher.',
        'If a tenant moves out still owing HUD money on the repayment agreement, the tenant will be given a letter notifying them of their balance with instructions to pay HUD back the balance owed.',
        'If a HUD overpayment is due to management error (failure to verify, etc.), tenants are not obligated to return subsidy to HUD. The loss will be absorbed by the property.',
      ] },
      { k: 'p', text: 'No Income Report: Identifies tenants who have no income reported. There are two No Income Reports: (1) No Income Reported on 50059 — pulls up tenants who reported zero income on their last 50059; (2) No Income Reported by HHS or SSA — pulls up tenants who show zero income in the HHS and SSA databases.' },
      { k: 'ul', items: [
        'The purpose of these reports is to allow managers to monitor zero-income tenants and to confirm that they in fact have zero source of income. In addition, if a known zero-income tenant is not showing up on the list, it is probable that they began receiving social security or other income.',
        { text: 'Tenants with zero income should be asked questions regarding their spending to confirm that they in fact have no income. Questions include:', sub: [
          'How does the tenant receive basic provisions such as food and clothing?',
          'How does the tenant pay for vehicles and/or other amenities?',
          'If previously employed, is the tenant receiving unemployment or a pension?',
          'Does the tenant expect to resume working, and when?',
        ] },
        'Documentation should be collected to confirm the tenant’s zero-income status.',
        'This report is not required at a set schedule, but it is good practice to run it at least quarterly. See the EIV Schedule for this property’s schedule and filing policy.',
        'It is not necessary to print and file these reports; some properties may choose to. See the EIV Schedule for this property’s filing policy.',
      ] },
      { k: 'p', text: 'New Hires Report (Summary & Detail): Identifies tenants who have new employment within the last 6 months. (Accessible under the Income Reports or under Verification Reports.)' },
      { k: 'ul', items: [
        'Management will contact those tenants who have not yet contacted them to confirm the employment information on the report. If the tenant does not dispute the new hire, they should bring in third-party verification for the employment. If the tenant disputes the report, verification must be obtained from the source of the disputed income.',
        'If necessary (change of $200 or more), process an Interim Recertification (IR) to account for the new income. If the tenant did not report the increase in time, they will not receive a 30-day notice.',
        'The New Hires Reports must be run at least quarterly. Some properties choose to run this report more often. See the EIV Schedule for this property’s schedule and filing policy.',
        'The New Hires Summary Reports must be printed and maintained in the “New Hires Report Master File” for a period of 3 years. Each tenant’s New Hires Detail Report must be saved in that tenant’s file (together with all correspondence, verifications, and certifications) for the entire term of tenancy plus three years.',
        'Sometimes the tenant will remain on the report even after the income has been added to a 50059. The manager will note that on the report.',
      ] },
      { k: 'h', text: 'Verification Reports' },
      { k: 'p', text: 'Existing Tenant Search: Identifies applicants who may be receiving rental assistance at another multi-family or Public Housing location.' },
      { k: 'ul', items: [
        'This report is run at the time of application for each member of the household. It will also be run for existing tenants if they are having an initial certification.',
        'If an applicant is found to be receiving assistance at a different location, management must discuss the circumstances of that assistance to avoid having the tenant receive a double subsidy. The other location must be contacted to verify the assistance and to arrange the move-out date from the current location and the move-in date to the new one. A copy of all correspondence must be kept.',
        'Management will not move in a tenant currently receiving subsidy at another location until they have written confirmation from the other location that the tenant has moved out.',
        'A copy of the report (as well as all correspondence, documentation, and verification) must be kept in the tenant file for the entire term of tenancy plus three years. If the applicant does not end up moving in, the report must be retained together with the application for three years.',
      ] },
      { k: 'p', text: 'Multiple Subsidy Report (Summary and Detail): Identifies tenants who may be receiving rental assistance at more than one location.' },
      { k: 'ul', items: [
        'This report must be run at least quarterly. Some properties choose to run this report more often. See the EIV Schedule for this property’s schedule and filing policy.',
        'The report will be run for all household members.',
        'If a tenant is found to be receiving multiple subsidies, management will discuss the circumstances with them. The other location will be contacted to determine the correct location to receive the subsidy.',
        'If a tenant is in fact receiving multiple subsidies, immediate action will be taken as appropriate, including termination of subsidy and possible eviction for violation of the lease. Any undue subsidy must be repaid to HUD.',
        'If a child is found to be living at multiple locations because of split custody, it must be determined how the childcare expenses (if any) are being claimed. Childcare expenses can be split between the two households when the custody and expense are documented for each household and the documentation demonstrates that the total expense claimed does not exceed the cost for the actual time the child spends in care.',
        'The Multiple Subsidy Report must be printed and maintained in the “Multiple Subsidy Report Master File” for a period of 3 years. Each tenant’s Multiple Subsidy Detail Report must be saved in that tenant’s file (together with all correspondence, verifications, and certifications) for the entire term of tenancy plus three years.',
      ] },
      { k: 'h', text: 'Identity Verification Reports' },
      { k: 'p', text: 'Failed EIV Pre-Screening Report: Identifies tenants who fail EIV because of invalid or missing personal identifiers such as SSN, Last Name, or Date of Birth. It also reports which tenants have a current certification date more than 15 months old.' },
      { k: 'ul', items: [
        'This report must be run monthly.',
        'Missing info must be entered and incorrect info corrected within 90 days. If the last cert is 15 months old, a new cert must be transmitted.',
        'The Failed EIV Pre-Screening Report must be printed and retained in a “Failed EIV Pre-Screening Master File” for 3 years. Tenant correspondence, verifications, and certifications related to the report must be retained in the tenant file for the entire term of tenancy plus 3 years.',
        'If a tenant is exempt from providing an SSN, they will still come up on this report. Make a notation on the report that the tenant is exempt.',
        'If tenant information was corrected at recertification but the EIV data has not yet been updated, this should be noted on the report.',
      ] },
      { k: 'p', text: 'Failed Verification Report (Failed the SSA Identity Test): Identifies tenants whose personal identifiers (SSN, Last Name, Date of Birth) do not match the SSA database. It also reports deceased tenants.' },
      { k: 'ul', items: [
        'This report must be run monthly.',
        'Management must follow up with tenants to verify their information and make the necessary corrections to certifications. If there is a mistake in the SSA system, the tenant should be advised to contact the SSA. A copy of form SSA-5 will be provided upon request.',
        'The Failed Verification Report must be printed and retained in a “Failed Verification Report Master File” for 3 years. Related tenant correspondence, verifications, and certifications must be retained in the tenant file for the entire term of tenancy plus 3 years.',
        'If tenant information was corrected at recertification but the EIV data has not yet been updated, this should be noted on the report.',
      ] },
      { k: 'p', text: 'Number of Households Not Verified: Identifies households that are in the process of being verified. This report is not required to be run or filed; it is a tool provided to owners as a courtesy.' },
      { k: 'p', text: 'Deceased Tenants Report: Identifies tenants reported deceased by the SSA.' },
      { k: 'ul', items: [
        'This report must be run at least quarterly. Some properties choose to run this report more often. See the EIV Schedule for this property’s schedule and filing policy.',
        'Management must confirm, in writing, with the head of household, next of kin, or emergency contact person/entity, whether the tenant is in fact deceased.',
        'If the tenant is deceased, the manager will update the family composition and any related income/assets/expenses within 30 days of the report. Any overpayment of subsidy must be returned to HUD.',
        'If the deceased tenant was the sole occupant of the unit, a move-out certification must be processed with the effective date being the earlier of (a) 14 days after the tenant’s death or (b) the date the unit was vacated.',
        'If the person is not deceased, management will encourage the tenant to contact the SSA to correct the information.',
        'The Deceased Tenant Report must be printed and retained in a “Deceased Tenant Report Master File” for 3 years. Related tenant correspondence, verifications, and certifications must be retained in the tenant file for the entire term of tenancy plus 3 years.',
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
