// VAWA notices (HUD forms 5380, 5381, 5382, 5383). The forms are HUD model
// notices reproduced verbatim; only the bracketed inserts are editable, via
// {{token}} fill-ins. 5380 is encoded; 5381/5382/5383 to follow.

export type VawaBlock =
  | { k: 'p'; lead?: string; text?: string }   // optional bold lead-in + body
  | { k: 'ul'; items: string[] }
  | { k: 'table'; headers: [string, string]; rows: [string, string][] }

export interface VawaForm {
  id: string
  code: string            // e.g. 'HUD-5380'
  title: string
  subtitle?: string
  omb?: string
  blocks: VawaBlock[]
}

// Editable bracket inserts (the only per-property fields on the 5380).
export interface VawaFill { key: string; label: string; help?: string }
export const VAWA_5380_FILLS: VawaFill[] = [
  { key: 'langContact', label: 'Language-assistance contact', help: 'Covered housing provider contact info (HOPWA: grantee name + contact).' },
  { key: 'langWebsite', label: 'Language-assistance website (optional)' },
  { key: 'transferContact', label: 'Emergency-transfer request instructions', help: 'Enter specific contact information, website, and/or instructions for requesting an emergency transfer or a copy of the applicable VAWA emergency transfer plan.' },
  { key: 'raContact', label: 'Reasonable-accommodation contact', help: 'Staff member to contact to request an accommodation.' },
  { key: 'fheoOffice', label: 'Local HUD FHEO field office', help: 'Office + contact info for VAWA-rights complaints.' },
  { key: 'advocacyContact', label: 'Local advocacy / legal-aid contact' },
]

export const VAWA_DEFAULT_FILLS: Record<string, string> = {
  langContact: '[covered housing provider contact information]',
  langWebsite: '[website, if applicable]',
  transferContact: '[enter specific contact information, website, and/or instructions for requesting an emergency transfer or a copy of the applicable VAWA emergency transfer plan]',
  raContact: '[insert appropriate staff member contact information]',
  fheoOffice: '[insert local HUD FHEO field office & contact information]',
  advocacyContact: '[enter contact info for local advocacy and legal aid organizations]',
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
    { k: 'p', lead: 'What if I require this information in a language other than English?', text: 'To read this information in Spanish or another language, please contact {{langContact}} or go to {{langWebsite}}. You can read translated VAWA forms at https://www.hud.gov/program_offices/administration/hudclips/forms/hud5a#4. If you speak or read in a language other than English, your covered housing provider must give you language assistance regarding your VAWA protections (for example, oral interpretation and/or written translation).' },
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

export const VAWA_FORMS: { id: string; code: string; label: string; ready: boolean }[] = [
  { id: '5380', code: 'HUD-5380', label: 'Notice of Occupancy Rights', ready: true },
  { id: '5381', code: 'HUD-5381', label: 'Emergency Transfer Plan', ready: false },
  { id: '5382', code: 'HUD-5382', label: 'Certification (self-certification)', ready: false },
  { id: '5383', code: 'HUD-5383', label: 'Emergency Transfer Request', ready: false },
]

export function vawaMerge(text: string | undefined, fills: Record<string, string>): string {
  if (!text) return ''
  const map = { ...VAWA_DEFAULT_FILLS, ...fills }
  return text.replace(/\{\{(\w+)\}\}/g, (_m, k) => (map[k] != null && map[k] !== '' ? map[k] : (VAWA_DEFAULT_FILLS[k] ?? `{{${k}}}`)))
}
