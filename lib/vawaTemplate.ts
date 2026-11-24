// VAWA notices (HUD forms 5380, 5381, 5382, 5383). The forms are HUD model
// notices reproduced verbatim; only the bracketed inserts are editable, via
// {{token}} fill-ins. 5380 is encoded; 5381/5382/5383 to follow.

export interface VawaWhen { flag?: string; notFlag?: string }
export type VawaBlock =
  | { k: 'p'; lead?: string; text?: string; when?: VawaWhen }   // optional bold lead-in + body
  | { k: 'h'; text: string; when?: VawaWhen }                   // bold section heading
  | { k: 'ul'; items: string[]; when?: VawaWhen }
  | { k: 'table'; headers: [string, string]; rows: [string, string][]; when?: VawaWhen }

export interface VawaForm {
  id: string
  code: string            // e.g. 'HUD-5380'
  title: string
  subtitle?: string
  omb?: string
  blocks: VawaBlock[]
}

// Editable bracket inserts. kind:'flag' renders a checkbox (value 'yes'/'').
export interface VawaFill { key: string; label: string; help?: string; prefill?: boolean; kind?: 'text' | 'flag'; optional?: boolean }
export const VAWA_5380_FILLS: VawaFill[] = [
  { key: 'langContact', label: 'Language-assistance contact', help: 'Covered housing provider contact info (HOPWA: grantee name + contact).' },
  { key: 'langWebsite', label: 'Language-assistance website (optional)' },
  { key: 'transferContact', label: 'Emergency-transfer request instructions', help: 'Enter specific contact information, website, and/or instructions for requesting an emergency transfer or a copy of the applicable VAWA emergency transfer plan.' },
  { key: 'raContact', label: 'Reasonable-accommodation contact', help: 'Staff member to contact to request an accommodation.' },
  { key: 'fheoOffice', label: 'Local HUD FHEO field office', help: 'Office + contact info for VAWA-rights complaints.' },
  // Pre-filled with the National DV Hotline; replace it or add local resources.
  { key: 'advocacyContact', label: 'Local advocacy / legal-aid contact', help: 'Replace or add your local advocacy and legal-aid organizations.', prefill: true },
]

export const VAWA_DEFAULT_FILLS: Record<string, string> = {
  langContact: '[covered housing provider contact information]',
  langWebsite: '',
  transferContact: '[enter specific contact information, website, and/or instructions for requesting an emergency transfer or a copy of the applicable VAWA emergency transfer plan]',
  raContact: '[insert appropriate staff member contact information]',
  fheoOffice: '[insert local HUD FHEO field office & contact information]',
  advocacyContact: 'National Domestic Violence Hotline 1-800-799-7233',
  // 5381 (Emergency Transfer Plan)
  chpName: '[name of covered housing provider]',
  chpAcronym: '[CHP]',
  programName: '[name of program or rental assistance]',
  internalImmediate: '[insert the provider’s policies for internal transfers when a safe unit is immediately available — including time frames for approving or denying a request once a full request is received, possible internal transfer options (without disclosing the victim’s location), and priority status relative to other tenants seeking transfers]',
  internalNotImmediate: '[insert the provider’s policies for internal transfers when a safe unit is not immediately available — including time frames, possible options (without disclosing the victim’s location), and priority status relative to other tenants seeking transfers]',
  externalTransfers: '[insert the provider’s policies for external transfers — including the provider’s role in facilitating them, any transfer agreements with outside providers, referrals to community partners and affordable housing, time frames for approving or denying a request, and priority given to VAWA victims seeking external transfers into the property]',
  voucherAssistance: '[insert policies and procedures for assisting tenants with Housing Choice Vouchers or other tenant-based rental assistance who qualify for an emergency transfer to move quickly with that assistance]',
  requestContact: '[insert specific contact information, website, e-mail address, and/or instructions for requesting an emergency transfer]',
  docDeadlineDays: '14',
  priorityMeasure: '[insert the measure of priority given to VAWA emergency transfers relative to other categories of tenants seeking transfers and individuals seeking placement on waiting lists]',
  confidentialityMeasures: '[insert the specific measures used to ensure the location of the victim’s unit is never disclosed to a person who committed or threatened to commit the VAWA violence/abuse]',
  availabilityPolicy: '[insert the provider’s policy for making this plan available upon request and, when feasible, publicly available]',
  localOrgs: '[insert contact information for local organizations offering assistance to victims of domestic violence, dating violence, sexual assault, or stalking]',
  externalExamples: '',
  internalExamples: '',
}

const BIFURCATION_ROWS: [string, string][] = [
  ['HOME and Housing Trust Fund, Continuum of Care Program (except for permanent supportive housing), ESG program, Section 221(d)(3) Program, Section 221(d)(5) Program, Rural Housing Stability Assistance Program',
    'Because these programs do not provide housing or assistance based on just one person’s status or characteristics, the remaining tenant(s), or family member(s) in the CoC program, can keep receiving assistance or living in the assisted housing as applicable.'],
  ['Permanent supportive housing funded by the Continuum of Care Program',
    'The remaining household member(s) can receive rental assistance until expiration of the lease that is in effect when the qualifying member is evicted.'],
  ['Housing Choice Voucher, Project-based Voucher, and Public Housing programs (for Special Purpose Vouchers (e.g., HUD-VASH, FUP, FYI, etc.), see also program specific guidance)',
    'If the person removed was the only tenant who established eligible citizenship/immigration status, the remaining household member(s) must be given 30 calendar days from the date of the lease bifurcation to establish program eligibility or find alternative housing. For HUD-VASH, if the veteran is removed, the remaining family member(s) can keep receiving assistance or living in the assisted housing as applicable. If the veteran was the only tenant who established eligible citizenship/immigration status, the remaining household member(s) must be given 30 calendar days to establish program eligibility or find alternative housing.'],
  ['Section 202/811 PRAC and SPRAC',
    'The remaining household member(s) must be given 90 calendar days from the date of the lease bifurcation or until the lease expires, whichever is first, to establish program eligibility or find alternative housing.'],
  ['Section 202/8',
    'The remaining household member(s) must be given 90 calendar days from the date of the lease bifurcation or when the lease expires, whichever is first, to establish program eligibility or find alternative housing. If the person removed was the only tenant who established eligible citizenship/immigration status, the remaining household member(s) must be given 30 calendar days from the date of the lease bifurcation to establish program eligibility or find alternative housing.'],
  ['Section 236 (including RAP); Project-based Section 8 and Mod Rehab/SRO',
    'The remaining household member(s) must be given 30 calendar days from the date of the lease bifurcation to establish program eligibility or find alternative housing.'],
  ['HOPWA',
    'The remaining household member(s) must be given no less than 90 calendar days, and not more than one year, from the date of the lease bifurcation to establish program eligibility or find alternative housing. The date is set by the HOPWA Grantee or Project Sponsor.'],
]

export const VAWA_5380: VawaForm = {
  id: '5380', code: 'HUD-5380',
  title: 'Notice of Occupancy Rights under the Violence Against Women Act',
  subtitle: 'Protections for Victims of Domestic Violence, Dating Violence, Sexual Assault or Stalking',
  omb: 'U.S. Department of Housing and Urban Development · OMB Approval No. 2577-0286',
  blocks: [
    { k: 'p', lead: 'When should I receive this form?', text: 'A covered housing provider must provide a copy of the Notice of Occupancy Rights Under The Violence Against Women Act (Form HUD-5380) and the Certification of Domestic Violence, Dating Violence, Sexual Assault, or Stalking (Form HUD-5382) when you are admitted as a tenant, when you receive an eviction or termination notice and prior to termination of tenancy, or when you are denied as an applicant. A covered housing provider may provide these forms at additional times.' },
    { k: 'p', lead: 'What is the Violence Against Women Act (“VAWA”)?', text: 'This notice describes protections that may apply to you as an applicant or a tenant under a housing program covered by a federal law called the Violence Against Women Act (“VAWA”). VAWA provides housing protections for victims of domestic violence, dating violence, sexual assault or stalking. VAWA protections must be in leases and other program documents, as applicable. VAWA protections may be raised at any time. You do not need to know the type or name of the program you are participating in or applying to in order to seek VAWA protections.' },
    { k: 'p', lead: 'What if I require this information in a language other than English?', text: 'To read this information in Spanish or another language, please contact {{langContact}}{{langGoToClause}}. You can read translated VAWA forms at https://www.hud.gov/program_offices/administration/hudclips/forms/hud5a#4. If you speak or read in a language other than English, your covered housing provider must give you language assistance regarding your VAWA protections (for example, oral interpretation and/or written translation).' },
    { k: 'p', lead: 'What do the words in this notice mean?' },
    { k: 'ul', items: [
      'VAWA violence/abuse means one or more incidents of domestic violence, dating violence, sexual assault, or stalking.',
      'Victim means any victim of VAWA violence/abuse.',
      'Affiliated person means the tenant’s spouse, parent, sibling, or child; or any individual, tenant, or lawful occupant living in the tenant’s household; or anyone for whom the tenant acts as parent/guardian.',
    ] },
    { k: 'p', text: 'Covered housing program includes the following HUD programs:' },
    { k: 'ul', items: [
      'Public Housing',
      'Tenant-based vouchers (TBV, also known as Housing Choice Vouchers or HCV) and Project-based Vouchers (PBV) Section 8 programs',
      'Section 8 Project-Based Rental Assistance (PBRA)',
      'Section 8 Moderate Rehabilitation Single Room Occupancy',
      'Section 202 Supportive Housing for the Elderly',
      'Section 811 Supportive Housing for Persons with Disabilities',
      'Section 221(d)(3)/(d)(5) Multifamily Rental Housing',
      'Section 236 Multifamily Rental Housing',
      'Housing Opportunities for Persons With AIDS (HOPWA) program',
      'HOME Investment Partnerships (HOME) program',
      'The Housing Trust Fund',
      'Emergency Solutions Grants (ESG) program',
      'Continuum of Care program',
      'Rural Housing Stability Assistance program',
    ] },
    { k: 'p', text: 'Covered housing provider means the individual or entity under a covered housing program that is responsible for providing or overseeing the VAWA protection in a specific situation. The covered housing provider may be a public housing agency, project sponsor, housing owner, mortgagor, housing manager, State or local government, public agency, or a nonprofit or for-profit organization as the lessor.' },
    { k: 'p', lead: 'What if I am an applicant under a program covered by VAWA?', text: 'You can’t be denied housing, housing assistance, or homeless assistance covered by VAWA just because you (or a household member) are or were a victim or just because of problems you (or a household member) had as a direct result of being or having been a victim. For example, if you have a poor rental or credit history or a criminal record, and that history or record is the direct result of you being a victim of VAWA abuse/violence, that history or record cannot be used as a reason to deny you housing or homeless assistance covered by VAWA.' },
    { k: 'p', lead: 'What if I am a tenant under a program covered by VAWA?', text: 'You cannot lose housing, housing assistance, or homeless assistance covered by VAWA or be evicted just because you (or a household member) are or were a victim of VAWA violence/abuse. You also cannot lose housing, housing assistance, or homeless assistance covered by VAWA or be evicted just because of problems that you (or a household member) have as a direct result of being or having been a victim. For example, if you are a victim of VAWA abuse/violence that directly results in repeated noise complaints and damage to the property, neither the noise complaints nor property damage can be used as a reason for evicting you from housing covered by VAWA. You also cannot be evicted or removed from housing, housing assistance, or homeless assistance covered by VAWA because of someone else’s criminal actions that are directly related to VAWA abuse/violence against you, a household member, or another affiliated person.' },
    { k: 'p', lead: 'How can tenants request an emergency transfer?', text: 'Victims of VAWA violence/abuse have the right to request an emergency transfer from their current unit to another unit for safety reasons related to the VAWA violence/abuse. An emergency transfer cannot be guaranteed, but you can request an emergency transfer when:' },
    { k: 'ul', items: [
      'You (or a household member) are a victim of VAWA violence/abuse;',
      'You expressly request the emergency transfer; AND',
      'EITHER you reasonably believe that there is a threat of imminent harm from further violence, including trauma, if you (or a household member) stay in the same dwelling unit;',
      'OR if you (or a household member) are a victim of sexual assault, either you reasonably believe that there is a threat of imminent harm from further violence, including trauma, if you (or a household member) were to stay in the unit, or the sexual assault occurred on the premises and you request an emergency transfer within 90 days (including holidays and weekend days) of when that assault occurred.',
    ] },
    { k: 'p', text: 'You can request an emergency transfer even if you are not lease compliant, for example if you owe rent. If you request an emergency transfer, your request, the information you provided to make the request, and your new unit’s location must be kept strictly confidential by the covered housing provider. The covered housing provider is required to maintain a VAWA emergency transfer plan and make it available to you upon request. To request an emergency transfer or to read the covered housing provider’s VAWA emergency transfer plan, {{transferContact}}. The VAWA emergency transfer plan includes information about what the covered housing provider does to make sure your address and other relevant information are not disclosed to your perpetrator.' },
    { k: 'p', lead: 'Can the perpetrator be evicted or removed from my lease?', text: 'Depending on your specific situation, your covered housing provider may be able to divide the lease to evict just the perpetrator. This is called “lease bifurcation.”' },
    { k: 'p', lead: 'What happens if the lease bifurcation ends up removing the perpetrator who was the only tenant who qualified for the housing or assistance?', text: 'In this situation, the covered housing provider must provide you and other remaining household members an opportunity to establish eligibility or to find other housing. If you cannot or don’t want to establish eligibility, then the covered housing provider must give you a reasonable time to move or establish eligibility for another covered housing program. This amount of time varies, depending on the covered housing program involved. The table below shows the reasonable time provided under each covered housing programs with HUD. Timeframes for covered housing programs operated by other agencies are determined by those agencies.' },
    { k: 'table', headers: ['Covered Housing Program(s)', 'Reasonable Time for Remaining Household Members to Continue to Receive Assistance, Establish Eligibility, or Move'], rows: BIFURCATION_ROWS },
    { k: 'p', lead: 'Are there any reasons that I can be evicted or lose assistance?', text: 'VAWA does not prevent you from being evicted or losing assistance for a lease violation, program violation, or violation of other requirements that are not due to the VAWA violence/abuse committed against you or an affiliated person. However, a covered housing provider cannot be stricter with you than with other tenants, just because you or an affiliated person experienced VAWA abuse/violence. VAWA also will not prevent eviction, termination, or removal if other tenants or housing staff are shown to be in immediate, physical danger that could lead to serious bodily harm or death if you are not evicted or removed from assistance. But only if no other action can be taken to reduce or eliminate the threat should a covered housing provider evict you or end your assistance, if the VAWA abuse/violence happens to you or an affiliated person. A covered housing provider must provide a copy of the Notice of Occupancy Rights Under The Violence Against Women Act (Form HUD-5380) and the Certification of Domestic Violence, Dating Violence, Sexual Assault, or Stalking (Form HUD-5382) when you receive an eviction or termination notice and prior to termination of tenancy.' },
    { k: 'p', lead: 'What do I need to document that I am a victim of VAWA abuse/violence?', text: 'If you ask for VAWA protection, the covered housing provider may request documentation showing that you (or a household member) are a victim. BUT the covered housing provider must make this request in writing and must give you at least 14 business days (weekends and holidays do not count) to respond, and you are free to choose any one of the following:' },
    { k: 'ul', items: [
      'A self-certification form (for example, Form-HUD 5382), which the covered housing provider must give you along with this notice. Either you can fill out the form or someone else can complete it for you;',
      'A statement from a victim/survivor service provider, attorney, mental health professional or medical professional who has helped you address incidents of VAWA violence/abuse. The professional must state “under penalty of perjury” that he/she/they believes that the incidents of VAWA violence/abuse are real and covered by VAWA. Both you and the professional must sign the statement;',
      'A police, administrative, or court record (such as a protective order) that shows you (or a household member) were a victim of VAWA violence/abuse; OR',
      'If allowed by your covered housing provider, any other statement or evidence provided by you.',
    ] },
    { k: 'p', text: 'It is your choice which documentation to provide and the covered housing provider must accept any one of the above as documentation. The covered housing provider is prohibited from seeking additional documentation of victim status or requiring more than one of these types of documentation, unless the covered housing provider receives conflicting information about the VAWA violence/abuse.' },
    { k: 'p', text: 'If you do not provide one of these types of documentation by the deadline, the covered housing provider does not have to provide the VAWA protections you requested. If the documentation received by the covered housing provider contains conflicting information about the VAWA violence/abuse, the covered housing provider may require you to provide additional documentation from the list above, but the covered housing provider must give you another 30 calendar days to do so.' },
    { k: 'p', lead: 'Will my information be kept confidential?', text: 'If you share information with a covered housing provider about why you need VAWA protections, the covered housing provider must keep the information you share strictly confidential. This information should be securely and separately kept from your other tenant files. No one who works for your covered housing provider will have access to this information, unless there is a reason that specifically calls for them to access this information, your covered housing provider explicitly authorizes their access for that reason, and that authorization is consistent with applicable law.' },
    { k: 'p', text: 'Your information will not be disclosed to anyone else or put in a database shared with anyone else, except in the following situations:' },
    { k: 'ul', items: [
      'If you give the covered housing provider written permission to share the information for a limited time;',
      'If the covered housing provider needs to use that information in an eviction proceeding or hearing; or',
      'If other applicable law requires the covered housing provider to share the information.',
    ] },
    { k: 'p', lead: 'How do other laws apply?', text: 'VAWA does not limit the covered housing provider’s duty to honor court orders about access to or control of the property, or civil protection orders issued to protect a victim of VAWA abuse/violence. Additionally, VAWA does not limit the covered housing provider’s duty to comply with a court order with respect to the distribution or possession of property among household members during a family break up. The covered housing provider must follow all applicable fair housing and civil rights requirements.' },
    { k: 'p', lead: 'Can I request a reasonable accommodation?', text: 'If you have a disability, your covered housing provider must provide reasonable accommodations to rules, policies, practices, or services that may be necessary to allow you to equally benefit from VAWA protections (for example, giving you more time to submit documents or assistance with filling out forms). You may request a reasonable accommodation at any time, even for the first time during an eviction. If a provider is denying a specific reasonable accommodation because it is not reasonable, your covered housing provider must first engage in the interactive process with you to identify possible alternative accommodations. To request a reasonable accommodation, please contact {{raContact}}. Your covered housing provider must also ensure effective communication with individuals with disabilities.' },
    { k: 'p', lead: 'Have your protections under VAWA been denied?', text: 'If you believe that the covered housing provider has violated these rights, you may seek help by contacting {{fheoOffice}}. You can also find additional information on filing VAWA complaints at https://www.hud.gov/VAWA and https://www.hud.gov/program_offices/fair_housing_equal_opp/VAWA. To file a VAWA complaint, visit https://www.hud.gov/fairhousing/fileacomplaint.' },
    { k: 'p', lead: 'Need further help?', text: 'For additional information on VAWA and to find help in your area, visit https://www.hud.gov/vawa. To talk with a housing advocate, contact {{advocacyContact}}.' },
    { k: 'p', text: 'This notice is required for covered housing programs under section 41411 of VAWA and 24 CFR 5.2003. Covered housing providers must give this notice to applicants and tenants to inform them of the VAWA protections as specified in section 41411(d)(2). This is a model notice, and no information is being collected.' },
  ],
}

// ---- HUD-5381 Emergency Transfer Plan -------------------------------------
// HUD "model" plan: the drafting notes (which must not appear in the adopted
// plan) are surfaced as field help, not printed. Site-specific policies are
// {{tokens}}; the written-request subsection is gated on requireWrittenRequest.
export const VAWA_5381_FILLS: VawaFill[] = [
  { key: 'chpName', label: 'Covered housing provider — full name', help: 'Full legal name (HOPWA providers: the grantee name).' },
  { key: 'chpAcronym', label: 'Covered housing provider — short name/acronym', help: 'Used throughout the plan, e.g. ARO.' },
  { key: 'programName', label: 'Program / rental assistance name', help: 'The program HUD oversees for VAWA compliance.' },
  { key: 'internalImmediate', label: 'Policy — internal transfer, safe unit immediately available', help: 'Time frames to approve/deny once a full request is received, options (without revealing the victim’s location), and priority vs. other transfers.' },
  { key: 'internalNotImmediate', label: 'Policy — internal transfer, safe unit not immediately available', help: 'Time frames, options, and priority vs. other transfers.' },
  { key: 'externalTransfers', label: 'Policy — external transfers', help: 'Provider’s role, transfer agreements, referrals, time frames, and priority for incoming VAWA victims.' },
  { key: 'voucherAssistance', label: 'Policy — tenant-based voucher assistance', help: 'How HCV / tenant-based assistance tenants move quickly with that assistance.' },
  { key: 'requestContact', label: 'How to request an emergency transfer', help: 'Specific contact info, website, e-mail, and/or instructions.' },
  { key: 'requireWrittenRequest', label: 'Require a written emergency-transfer request', kind: 'flag', help: 'If on, the plan states what a written request must include (HUD-5383 may be used). Requests may otherwise be oral.' },
  { key: 'docDeadlineDays', label: 'Documentation deadline (business days)', help: 'Must be at least 14 business days (weekends/holidays excluded).' },
  { key: 'priorityMeasure', label: 'Priority given to VAWA emergency transfers', help: 'The measure of priority vs. other transfers and waiting-list applicants. Internal transfers must get at least any priority given to other emergency transfers.' },
  { key: 'confidentialityMeasures', label: 'Confidentiality measures (protecting the victim’s location)', help: 'Specific measures ensuring the victim’s unit location is never disclosed to the perpetrator.' },
  { key: 'availabilityPolicy', label: 'How the plan is made available', help: 'Policy for making the plan available on request and, when feasible, publicly available.' },
  { key: 'localOrgs', label: 'Local victim-assistance organizations', help: 'Contact information for local organizations assisting victims.' },
  { key: 'externalExamples', label: 'External-transfer examples (optional)', optional: true, help: 'Appended to the definition as “For example, …”.' },
  { key: 'internalExamples', label: 'Internal-transfer examples (optional)', optional: true, help: 'Appended to the definition as “For example, …”.' },
]

export const VAWA_5381: VawaForm = {
  id: '5381', code: 'HUD-5381',
  title: 'Emergency Transfer Plan for Victims of Domestic Violence, Dating Violence, Sexual Assault, and Stalking',
  omb: 'U.S. Department of Housing and Urban Development · OMB Approval No. 2577-0286',
  blocks: [
    { k: 'p', text: '{{chpName}} is concerned about the safety of its tenants, and such concern extends to tenants who are victims of domestic violence, dating violence, sexual assault, or stalking. In accordance with the Violence Against Women Act of 1994, as amended (“VAWA”), {{chpAcronym}} allows any tenant who is a victim of domestic violence, dating violence, sexual assault, or stalking to request an emergency transfer from the tenant’s current unit to another unit. VAWA protections are not limited to women. Victims cannot be discriminated against on the basis of any protected characteristic, including race, color, national origin, religion, sex, familial status, disability, or age.' },
    { k: 'p', text: 'This plan identifies tenants who are eligible for an emergency transfer, the documentation needed to request an emergency transfer, confidentiality protections, how an emergency transfer may occur, and guidance regarding safety and security. The plan is based on Federal regulations at 24 CFR part 5, subpart L, related program regulations, and the model emergency transfer plan published by HUD. HUD is the Federal agency that oversees that {{programName}} is in compliance with VAWA.' },

    { k: 'h', text: 'Definitions' },
    { k: 'p', lead: 'External emergency transfer', text: 'refers to an emergency relocation of a tenant to another unit where the tenant would be categorized as a new applicant; that is, the tenant must undergo an application process in order to reside in the new unit.{{externalExamplesClause}}' },
    { k: 'p', lead: 'Internal emergency transfer', text: 'refers to an emergency relocation of a tenant to another unit where the tenant would not be categorized as a new applicant; that is, the tenant may reside in the new unit without having to undergo an application process.{{internalExamplesClause}}' },
    { k: 'p', lead: 'Safe unit', text: 'refers to a unit that the victim of VAWA violence/abuse believes is safe.' },
    { k: 'p', lead: 'VAWA violence/abuse', text: 'means an incident or incidents of domestic violence, dating violence, sexual assault, or stalking, as those terms are defined in 24 CFR 5.2003 and the “Certification of Domestic Violence, Dating Violence, Sexual Assault, or Stalking” (Form HUD-5382).' },

    { k: 'h', text: 'Eligibility for Emergency Transfers' },
    { k: 'p', text: 'A tenant may seek an emergency transfer to another unit if they or their household member is a victim of VAWA violence/abuse, as outlined in the “Notice of Occupancy Rights Under the Violence Against Women Act,” Form HUD-5380. This emergency transfer plan provides further information on emergency transfers, and {{chpAcronym}} must provide a copy if requested. {{chpAcronym}} may ask for submission of a written request for an emergency transfer, such as Form HUD-5383, to certify eligibility for the emergency transfer.' },
    { k: 'p', text: 'A tenant is eligible for an emergency transfer if:' },
    { k: 'ul', items: [
      'The tenant (or their household member) is a victim of VAWA violence/abuse;',
      'The tenant expressly requests the emergency transfer; AND',
      'EITHER the tenant reasonably believes that there is a threat of imminent harm from further violence, including trauma, if they (or their household member) stay in the same dwelling unit;',
      'OR if the tenant (or their household member) is a victim of sexual assault, either the tenant reasonably believes that there is a threat of imminent harm from further violence, including trauma, if the tenant (or their household member) were to stay in the unit, or the sexual assault occurred on the premises and the tenant requested an emergency transfer within 90 days (including holidays and weekend days) of when that assault occurred.',
    ] },
    { k: 'p', text: '{{chpAcronym}}, in response to an emergency transfer request, should not evaluate whether the tenant is in good standing as part of the assessment or provision of an emergency transfer. Whether or not a tenant is in good standing does not impact their ability to request an emergency transfer under VAWA.' },

    { k: 'h', text: 'Emergency Transfer Policies' },
    { k: 'p', lead: 'Internal transfers when a safe unit is immediately available:', text: '{{internalImmediate}}' },
    { k: 'p', lead: 'Internal transfers when a safe unit is not immediately available:', text: '{{internalNotImmediate}}' },
    { k: 'p', lead: 'External transfers:', text: '{{externalTransfers}}' },
    { k: 'p', text: '{{voucherAssistance}}' },
    { k: 'p', text: 'VAWA provisions do not supersede eligibility or other occupancy requirements that may apply under a covered housing program. {{chpAcronym}} may be unable to transfer a tenant to a particular unit if the tenant cannot establish eligibility for that unit.' },

    { k: 'h', text: 'Emergency Transfer Request Documentation' },
    { k: 'p', text: 'To request an emergency transfer, the tenant shall notify {{requestContact}}. If {{chpAcronym}} does not already have documentation of the occurrence of domestic violence, dating violence, sexual assault, or stalking, {{chpAcronym}} may ask for this documentation in accordance with 24 CFR 5.2007. If {{chpAcronym}} requests documentation, the tenant will have at least {{docDeadlineDays}} business days (weekends and holidays excluded) to provide it. Unless {{chpAcronym}} receives documentation that contains conflicting information, as described in 24 CFR 5.2007(b)(2), {{chpAcronym}} cannot require third-party documentation to determine status as a VAWA victim for emergency transfer eligibility. {{chpAcronym}} will provide reasonable accommodations to this policy for individuals with disabilities.' },
    { k: 'p', when: { flag: 'requireWrittenRequest' }, lead: 'Written request.', text: 'The tenant’s written request for an emergency transfer must include either:' },
    { k: 'ul', when: { flag: 'requireWrittenRequest' }, items: [
      'A statement expressing that the tenant reasonably believes that there is a threat of imminent harm from further violence, including trauma, if the tenant (or household member) stays in the same dwelling unit; OR',
      'In the case of a tenant (or household member) who is a victim of sexual assault, either a statement that the tenant reasonably believes there is a threat of imminent harm from further violence or trauma if the tenant (or household member) stays in the same dwelling unit, or a statement that the sexual assault occurred on the premises and the tenant requested an emergency transfer within 90 days (including holidays and weekend days) of when the assault occurred.',
    ] },
    { k: 'p', when: { flag: 'requireWrittenRequest' }, text: 'Form HUD-5383 may be used for making a written request for an emergency transfer.' },

    { k: 'h', text: 'Priority for Transfers' },
    { k: 'p', text: 'Tenants who qualify for an emergency transfer under VAWA will be given the following priority over other categories of tenants seeking transfers and individuals seeking placement on waiting lists. {{priorityMeasure}}' },

    { k: 'h', text: 'Confidentiality' },
    { k: 'p', text: 'If a tenant inquires about or requests any VAWA protections or represents that they or a household member are a victim of VAWA violence/abuse entitled to VAWA protections, {{chpAcronym}} must keep any information they provide concerning the VAWA violence/abuse, their request for an emergency transfer, and their or a household member’s status as a victim strictly confidential. This information should be securely and separately kept from tenant files. All the information provided by or on behalf of the tenant to support an emergency transfer request, including information on the Certification Form (HUD-5382) and the Emergency Transfer Request Form (HUD-5383) (collectively referred to as “Confidential Information”) may only be accessed by {{chpAcronym}} employees or contractors if explicitly authorized by {{chpAcronym}} for reasons that specifically call for those individuals to have access to that information under applicable Federal, State, or local law.' },
    { k: 'p', text: 'Confidential information must not be entered into any shared database or disclosed to any other entity or individual, except if:' },
    { k: 'ul', items: [
      'Written permission by the victim in a time-limited release;',
      'Required for use in an eviction proceeding or hearing regarding termination of assistance; or',
      'Otherwise required by applicable law.',
    ] },
    { k: 'p', text: 'In addition, HUD’s VAWA regulations require emergency transfer plans to provide strict confidentiality measures to ensure that the location of the victim’s dwelling unit is never disclosed to a person who committed or threatened to commit the VAWA violence/abuse. Accordingly, {{confidentialityMeasures}}' },

    { k: 'h', text: 'Emergency Transfer Procedure' },
    { k: 'p', text: '{{chpAcronym}} cannot specify how long it will take from the time a transfer request is approved until the tenant can be placed in a new, safe unit. {{chpAcronym}} will, however, act as quickly as possible to assist a tenant who qualifies for an emergency transfer. If {{chpAcronym}} identifies an available unit and the tenant believes that unit would not be safe, the tenant may request a transfer to a different unit. {{chpAcronym}} may be unable to transfer a tenant and their household to a particular unit if the tenant and their household has not established or cannot establish eligibility for that unit.' },
    { k: 'p', text: 'If {{chpAcronym}} does not have any safe and available units for which the tenant is eligible, {{chpAcronym}} will assist the tenant in identifying other covered housing providers who may have safe and available units to which the tenant could move. At the tenant’s request, {{chpAcronym}} will also assist the tenant in contacting the local organizations offering assistance to victims of VAWA violence/abuse that are attached to this plan.' },

    { k: 'h', text: 'Making the Emergency Transfer Plan Available' },
    { k: 'p', text: '{{availabilityPolicy}}' },

    { k: 'h', text: 'Safety and Security of Tenants' },
    { k: 'p', text: 'When {{chpAcronym}} receives any inquiry or request regarding an emergency transfer, {{chpAcronym}} will encourage the person making the inquiry or request to take all reasonable precautions to be safe, including seeking guidance and assistance from a victim service provider. However, tenants are not required to receive guidance or assistance from a victim service provider.' },
    { k: 'p', text: 'For additional information on VAWA and to find help in your area, visit https://www.hud.gov/vawa.' },
    { k: 'p', text: '{{localOrgs}}' },
    { k: 'p', text: 'This plan is a required policy under 24 CFR 5.2005(e).' },
  ],
}

export const VAWA_FORMS: { id: string; code: string; label: string; ready: boolean }[] = [
  { id: '5380', code: 'HUD-5380', label: 'Notice of Occupancy Rights', ready: true },
  { id: '5381', code: 'HUD-5381', label: 'Emergency Transfer Plan', ready: true },
  { id: '5382', code: 'HUD-5382', label: 'Certification (self-certification)', ready: false },
  { id: '5383', code: 'HUD-5383', label: 'Emergency Transfer Request', ready: false },
]

export const VAWA_FORM_BY_ID: Record<string, VawaForm> = { '5380': VAWA_5380, '5381': VAWA_5381 }
export const VAWA_FILLS_BY_FORM: Record<string, VawaFill[]> = { '5380': VAWA_5380_FILLS, '5381': VAWA_5381_FILLS }

export function vawaMerge(text: string | undefined, fills: Record<string, string>): string {
  if (!text) return ''
  const map: Record<string, string> = { ...VAWA_DEFAULT_FILLS, ...fills }
  // Derived clauses that are omitted entirely when their field is blank.
  const site = (fills.langWebsite ?? '').trim()
  const ext = (fills.externalExamples ?? '').trim()
  const intl = (fills.internalExamples ?? '').trim()
  const derived: Record<string, string> = {
    langGoToClause: site ? ` or go to ${site}` : '',
    externalExamplesClause: ext ? ` For example, ${ext}` : '',
    internalExamplesClause: intl ? ` For example, ${intl}` : '',
  }
  return text.replace(/\{\{(\w+)\}\}/g, (_m, k) => {
    if (k in derived) return derived[k]                          // may be empty on purpose
    const v = map[k]
    return (v != null && v !== '') ? v : (VAWA_DEFAULT_FILLS[k] ?? `{{${k}}}`)
  })
}
