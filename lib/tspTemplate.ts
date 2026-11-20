// Tenant Selection Plan — master template (Layer 1).
// Content tracks ARO_Tenant_Selection_Plan REDLINE 2026-11-05 (HUD 4350.3
// REV-1). Variable parts:
//   - {{mergeKey}} tokens          -> cover/identity fields (property name, units, …)
//   - block `when` conditions      -> demographic / state / program gating
//   - choice + upload blocks        -> per-property settings (wired in the generator)
//   - footnotes                     -> HUD citations rendered as endnotes (lib/tspFootnotes)
//
// Sections I–VII are fully encoded. HOTMA is intentionally omitted (comments
// #29, #174). Per comment #101 only the applicable state module is generated
// (NJ Fair Chance in Housing Act, or the standard criminal standards).

export type TspDemo = 'family' | 'elderly' | 'elderly_disabled'
export type TspState = 'nj' | 'other'
// Program families that gate certain paragraphs. 'pac_prac' = the Section 202
// PAC / 202 PRAC / 811 PRAC programs; 'section8' = project-based Section 8.
export type TspProgram = 'section8' | 'section202_8' | 'pac_prac' | 'section236' | 'other'

export interface When {
  demo?: TspDemo[]
  state?: TspState[]
  program?: TspProgram[]
  flag?: string       // render only when this boolean setting is truthy
  notFlag?: string    // render only when this boolean setting is falsy
  choiceEq?: { setting: string; value: string }  // render only when a choice equals value
}

export type ListItem = string | { text: string; sub?: ListItem[]; when?: When }
export type Block =
  | { k: 'p'; text: string; when?: When }
  | { k: 'h'; text: string; when?: When }   // sub-heading inside a section
  | { k: 'ul'; items: ListItem[]; when?: When }
  | { k: 'choice'; setting: string; when?: When }        // render the chosen option (from settings)
  | { k: 'table'; id: string; when?: When }              // e.g. occupancy min/max per bedroom
  | { k: 'upload'; setting: string; fallback: Block[]; when?: When } // uploaded criteria, else fallback

export interface Section { id: string; num: string; title: string; blocks: Block[]; when?: When }

// Boolean toggles referenced by `flag` / `notFlag` in block `when` conditions.
export type TspFlag =
  | 'drugEvictionBar'      // #94  include the 3-year drug-eviction admission bar
  | 'arrestsAsFactor'      // #98  include the "arrests alone don't disqualify" stance
  | 'displacedPreference'  // #70/#71  property adopts the displaced preference
  | 'hasAccessibleUnits'   // #150 property has accessible units
  | 'noSmallerUnitHold'    // remove the smaller-unit transfer-hold rule (§IV)

// Single-select choice blocks: setting -> selected option id.
export type TspChoiceKey =
  | 'incomeLimit'            // #39
  | 'incomeTargetingMethod'  // #46
  | 'consent9887Timing'      // #30
  | 'inHouseTransferPolicy'  // #158
  | 'transferAlternation'    // procedure when non-mandated transfers are allowed

// Upload blocks: setting -> pasted/extracted text (empty => use fallback).
export type TspUploadKey = 'screeningCriteria' | 'creditCriteria'   // #103/#104, #119

export interface TspSettings {
  merge?: Record<string, string>   // propertyName, demographicLabel, numberOfUnits, programLabel,
                                    // hudProjectNo, hapContractNo, hapEffectiveDate, occupancyBasis,
                                    // otherPreferences, lookback*, creditLookbackYears,
                                    // creditUnpaidThreshold, section504Coordinator, raResponseDays,
                                    // accessibleMobilityCount, accessibleHearingVisionCount,
                                    // incomeTargetingOther, …
  demo?: TspDemo
  state?: TspState
  program?: TspProgram
  flags?: Partial<Record<TspFlag, boolean>>
  choices?: Partial<Record<TspChoiceKey, string>>
  uploads?: Partial<Record<TspUploadKey, string>>
  unitSizeRows?: UnitSizeRow[]     // occupancy min/max per bedroom (table id 'unitSize')
  overrides?: Record<string, string>   // sectionId -> replacement wording (blank => template)
  customItems?: TspCustomItem[]        // property-specific items appended to a section
}

export interface UnitSizeRow { unit: string; min: string; max: string }
export interface TspCustomItem { id: string; sectionId: string; text: string }

// The full "disabled family" definition (comment #9), shown for elderly_disabled.
const DISABLED_FAMILY_DEF: ListItem[] = [
  { text: 'A disabled family means:', sub: [
    'Families of two or more persons the head of which (or his or her spouse) is a person with disabilities (handicapped);',
    'The surviving member or members of any family described in paragraph (1) of this definition living in a unit assisted under subpart E of this part (Section 202 loans) with the deceased member of the family at the time of his or her death;',
    'A single person with disabilities (handicapped person) over the age of 18; or',
    'Two or more persons with disabilities (handicapped persons) living together, or one or more such persons living with another person who is determined by HUD, based upon a licensed physician’s certificate provided by the family, to be essential to their care or well-being.',
  ] },
  { text: 'Disability means:', sub: [
    'Any adult having a physical, mental, or emotional impairment that is expected to be of long-continued and indefinite duration, substantially impedes his or her ability to live independently, and is of a nature that such ability could be improved by more suitable housing conditions.',
    { text: 'A person with a developmental disability, as defined in Section 102(7) of the Developmental Disabilities Assistance and Bill of Rights Act (42 U.S.C. 6001(8)), i.e., a person with a severe chronic disability that:', sub: [
      'Is attributable to a mental or physical impairment or combination of mental and physical impairments;',
      'Is manifested before the person attains age 22;',
      'Is likely to continue indefinitely;',
      { text: 'Results in substantial functional limitation in three or more of the following areas of major life activity:', sub: [
        'Self-care,',
        'Receptive and expressive language,',
        'Learning,',
        'Mobility,',
        'Self-direction,',
        'Capacity for independent living, and',
        'Economic self-sufficiency; and,',
      ] },
      'Reflects the person’s need for a combination and sequence of special, interdisciplinary, or generic care, treatment, or other services that are of lifelong or extended duration and are individually planned and coordinated.',
    ] },
    'A person with a chronic mental illness, i.e., a person who has a severe and persistent mental or emotional impairment that seriously limits his or her ability to live independently, and whose impairment could be improved by more suitable housing conditions.',
    'Persons infected with the human acquired immunodeficiency virus (HIV) who are disabled as a result of infection with the HIV are eligible for occupancy in the Section 202 projects designed for the physically disabled, developmentally disabled, or chronically mentally ill, depending upon the nature of the person’s disability.',
  ] },
]

export const TSP_SECTIONS: Section[] = [
  {
    id: 'eligibility', num: 'I', title: 'Eligibility Requirements', blocks: [
      { k: 'p', text: 'In order for the applicant household to be eligible to receive assistance under the program specific to this property, the following criteria must be met:' },

      { k: 'h', text: 'Project Eligibility' },
      { k: 'p', text: 'The applicant household must be a family — any family as defined at 24 CFR 5.403.', when: { demo: ['family'] } },
      { k: 'p', text: 'The applicant household must be an elderly family — the head, co-head, spouse, or sole member is age 62 or older (24 CFR 5.403).', when: { demo: ['elderly'] } },
      { k: 'p', text: 'The applicant household must be an elderly or disabled family — the head, co-head, spouse, or sole member is age 62 or older, or is a person with disabilities (24 CFR 5.403).', when: { demo: ['elderly_disabled'] } },
      { k: 'ul', items: DISABLED_FAMILY_DEF, when: { demo: ['elderly_disabled'] } },
      { k: 'p', text: 'Basis for this occupancy designation: {{occupancyBasis}}.' },

      { k: 'h', text: 'The remaining member of a tenant family' },
      { k: 'p', text: 'To qualify as a “remaining family member,” when the head of household leaves the unit, certain criteria must be met. These criteria are as follows:' },
      { k: 'ul', items: [
        'The individual must be a party to the Lease when the family member leaves the unit.',
        'The individual must be of legal contract age — at least 18 years of age.',
        { text: 'The individual must be eligible for the specific program of the project occupied.', when: { program: ['section202_8', 'pac_prac'] } },
        'If the head of household passes away, the remaining member(s) must meet criteria 1 and 2 only.',
        'A live-in aide does not qualify as a remaining family member, even if the live-in aide is related to the head of household.',
      ] },

      { k: 'h', text: 'Program Eligibility' },
      { k: 'h', text: 'Social Security Number' },
      { k: 'ul', items: [
        'The applicant must provide verification of Social Security numbers for all household members (including live-in aides, foster children, and foster adults) regardless of age, before they can be admitted.',
        'There are only two exceptions to this requirement: (1) an applicant who does not contend to have eligible immigration status (see Citizenship Status below); or (2) seniors age 62 and older as of 1/31/2010 who were already living in Section 8 housing as of 1/31/2010 (verifiable by the Existing Tenant Search in EIV — see III.F.6). This exemption must be documented through EIV or by the prior property; an applicant’s self-certification is not sufficient.',
        'Applicants will be informed of this requirement at the time of application and advised that if they or any member of their household does not have an SSN, they should begin the process of obtaining one.',
        'If a child under the age of 6 was added to the applicant’s household within the 6-month period prior to the household’s date of admission, the child may participate so long as the required documentation is provided to management within 90 days of admission. A 90-day extension may be granted for extenuating circumstances.',
        'If management has determined that the applicant is otherwise eligible and the only outstanding verification is the SSN, the applicant may retain their place on the waiting list for 90 days, beginning on the date the applicant is first offered an available unit, while trying to obtain documentation. Management will skip the household and offer the unit to one lower on the waiting list who can comply with the SSN requirements.',
        'If after 90 days the applicant is unable to supply the SSN documentation, the applicant will be determined ineligible and removed from the waiting list.',
        'Any new member seeking to be added to an existing household must supply their SSN at the time of the request to enter the household, or at the Interim/Annual Certification where they are being added.',
        'Children under the age of six who have not yet been assigned an SSN must obtain one within 90 days of being added to the household. A 90-day extension may be granted for extenuating circumstances.',
      ] },

      { k: 'h', text: 'Citizenship Status' },
      { k: 'ul', items: [
        'Only citizens and eligible non-citizens may benefit from HUD rental assistance.',
        'A notice of the requirement to submit evidence of citizenship or eligible immigration status will be given to applicants when they apply. Where possible, management will provide this notice in a language understood by the individual if the person is not proficient in English.',
        { text: 'All family members, regardless of age, must declare their citizenship or immigration status by completing:', sub: [
          'Family Summary Sheet — to provide the owner with information on each household member.',
          'Citizenship Declaration Form — to declare Citizenship, Eligible Immigration Status, or Not Contending Eligible Status and acknowledge ineligibility.',
        ] },
        { text: 'Management will require documentation for the immigration status:', sub: [
          'For households claiming U.S. Citizenship, the signed declaration (or parent’s signature for a minor) is sufficient documentation.',
          'For non-citizens claiming eligible immigration status who are 62 years of age or older, the signed declaration plus proof of age is sufficient documentation.',
          'All other non-citizens claiming eligible immigration status must provide: (1) the signed declaration; (2) a Department of Homeland Security (DHS) document (see the declaration for the list of approved documents); and (3) a signed verification consent form.',
        ] },
        'If management suspects that the applicant has misreported their immigration status, or altered or forged documents, the case may be reported to the HUD Office of the Inspector General for investigation.',
        'Management will not deny assistance to applicants where at least one family member has submitted their immigration documentation in a timely manner but for whom the DHS verification process has not been completed, so long as the household meets all other eligibility criteria.',
        'If a unit is available, the family has reached the top of the waiting list, and at least one member has submitted the required documentation in a timely manner (within 30 days of request), management must offer the family a unit, providing subsidy to those members whose documents were received on time. Until management has received and verified the immigration status of any remaining non-citizen family members, only prorated assistance will be provided to the family.',
        'If only some members of the household are eligible citizens/immigrants, it is a mixed family and subsidy will be prorated — divided by the number of household members and provided only for the eligible members.',
        'If no members can provide verifiable documentation of citizenship, occupancy will be denied until the required documentation is provided.',
        'If the applicant household has applied to DHS for an informal hearing or an appeal regarding verification of citizenship status, management may not deny, delay, or reduce assistance; the household will be processed for move-in as usual. If, after move-in, DHS notifies management that the household (or a member) is an ineligible non-citizen, assistance will immediately be terminated or prorated. (DHS must notify the household and management within 30 days of the hearing or appeal.)',
        { text: 'Non-citizen students and their non-citizen families may not receive assistance. Non-citizen students are not eligible for continuation of assistance, prorated assistance, or temporary deferral of termination. A non-citizen student is defined as an individual who is:', sub: [
          'A resident of another country to which the individual intends to return;',
          'A bona fide student pursuing a course of study in the United States; and',
          'A person admitted to the United States solely to pursue a course of study, as indicated on an F-1 or M-1 student visa.',
        ] },
        'This prohibition applies to the non-citizen student’s non-citizen spouse and children. However, spouses and children who are citizens may receive assistance. For example, a family that includes a non-citizen student married to a U.S. citizen is a mixed family.',
      ] },

      { k: 'h', text: 'Student Eligibility' },
      { k: 'p', text: 'The applicant Head of Household must be of legal contract age (18 years of age or older).' },
      { k: 'ul', items: [
        { text: 'Subsidy will not be provided to any individual who is enrolled as a part- or full-time student at an institution of higher education for the purpose of obtaining a degree, certificate, or other recognized educational credential, and who:', sub: [
          'Is under 24; and',
          'Is not married; and',
          'Is not a veteran of the U.S. military; and',
          'Does not have a dependent child; and',
          'Is not a person with disabilities (as defined in Section 3(b)(3)(E) of the U.S. Housing Act of 1937) who was receiving Section 8 assistance as of November 30, 2005; and',
          'Is not living with his/her parent(s) who are receiving subsidy; and',
          'Is not individually eligible to receive subsidy, or has parents who are not income-eligible to receive subsidy.',
        ] },
        { text: 'The exception is if the student is either married, a veteran, an orphan or ward of the state; has one or more dependents; has enrolled in a graduate professional course of study; or qualifies as an “independent student,” which means the student:', sub: [
          'Is of legal contract age under state law;',
          'Has established a household separate from parents or legal guardians for at least one year prior to application for occupancy, or meets the U.S. Department of Education’s definition of an independent student; and',
          'Is not claimed as a dependent by parents or legal guardians pursuant to IRS regulations.',
        ] },
        'An applicant designated an “independent student” will use only their own income to determine eligibility, not that of their parents/guardian.',
        { text: '“Independent student” status will be verified with:', sub: [
          'Previous address information to show evidence of a separate household, or verification that the student meets the U.S. Department of Education’s definition of an independent student;',
          'Prior-year tax returns for the parents to determine if the parents claim the student as a dependent (except where the student meets the DoE definition of independent student);',
          'Written certification by a parent of the amount of financial support provided, or written certification that the parent provides no support. Financial assistance provided by persons not living in the unit is part of annual income (see exceptions below).',
        ] },
        { text: 'In 2016 HUD updated its “independent student” rules to include the Department of Education definition — a student who:', sub: [
          'Is 24 years of age or older by December 31 of the year of move-in; or',
          'Is, or was, an orphan, in foster care, or a ward of the court at any time when the individual was 13 years of age or older; or',
          'Is, or was, an emancipated minor or in legal guardianship as determined by a court in the individual’s state of residence; or',
          'Is a veteran, or is currently serving on active duty in the Armed Forces for other than training purposes; or',
          'Is a graduate or professional student; or',
          'Is married; or',
          'Has legal dependents other than a spouse; or',
          'Has been verified during the school year of the application as an unaccompanied youth who is homeless (as defined by the McKinney-Vento Homeless Assistance Act), or as unaccompanied, at risk of homelessness, and self-supporting, by an approved agency; or',
          'Is a student for whom a financial aid administrator makes a documented determination of independence based on other unusual circumstances.',
        ] },
        'When verifying “independent student” status under the Department of Education definition, no parental tax return is required.',
        'For the 2nd, 3rd, and 8th options above, the student is a “vulnerable youth” and needs no further verification to be designated an independent student; in these cases, financial assistance provided by persons not living in the unit is not part of annual income.',
        'This rule applies only to full- or part-time students applying to live on their own, not those applying to live with a parent/guardian. The student rule (24 CFR 5.612) applies to Section 8 assistance only.',
      ] },

      { k: 'p', text: 'At move-in, if a household’s Total Tenant Payment (TTP) exceeds the gross rent, the family may not be considered an eligible family even if their Annual Income is below the applicable income limit. (An applicant cannot be admitted as an assisted resident but, under certain circumstances, could be admitted as a market renter.)' },

      { k: 'h', text: 'Consent Forms' },
      { k: 'ul', items: [
        'The head of household, spouse, and co-head (regardless of age) and all other household members 18 and older must sign the Notice and Consent for the Release of Information, Form HUD-9887, at the time of initial certification and at each annual recertification thereafter. Additional signatures must be obtained from new adult members when they join the household and when members turn 18. Failure to sign may result in denial of assistance or termination of assisted housing benefits, following the procedures set by HUD / the Lease Agreement.',
        'All adult household members (18 and older) must sign the Applicant’s/Tenant’s Consent to the Release of Information, Form HUD-9887-A, at the time of initial certification and at each annual recertification thereafter. Failure to sign may result in denial of assistance or termination; for a resident, the Lease Agreement procedures apply, including payment of the higher HUD-approved market rent for failure to provide recertification information.',
        { text: 'When a household member attains 18 years of age between Annual Recertifications, they must report to management within 60 days or by the time of the next recertification (whichever is earlier) and sign the household’s Form HUD-9887 so that income-report data for that member can be used in the family’s next recertification.', sub: [
          'Failure to sign within this timeframe will constitute lease non-compliance, and the household’s assistance and/or tenancy may be terminated. This notification requirement will be part of the property’s House Rules.',
          'Management will provide written notice of this requirement to each household with a 17-year-old member at the time of any Annual or Interim Certification.',
        ] },
      ] },
      // Comment #30: for a member who turns 18 during the year, the property
      // chooses whether they sign now or at the next AR (EIV can't run until signed).
      { k: 'choice', setting: 'consent9887Timing' },

      { k: 'h', text: 'Rent and Residency' },
      { k: 'p', text: 'The applicant must be willing to pay the rent calculated according to HUD rules. A minimum Total Tenant Payment of twenty-five dollars per month must be charged according to Federal law, except as stated below. (Applicable to Section 8 Program recipients only.)', when: { program: ['section8', 'section202_8'] } },
      { k: 'ul', when: { program: ['section8', 'section202_8'] }, items: [
        'Management will consider hardship exceptions to the minimum rent requirement.',
        'Short-term hardships (90 days or less): the minimum rent payment is deferred for 90 days, after which the household must sign a reasonable repayment agreement to repay the deferred minimum rent.',
        'Long-term hardships (91 days and longer): the minimum rent requirement is waived until the hardship no longer exists. No repayment is required.',
        { text: 'Hardships are as follows and MUST BE VERIFIED, in writing:', sub: [
          'The household has lost eligibility for a federal, state, or local assistance program;',
          'The household has applied for a federal, state, or local assistance program and is awaiting a determination;',
          'The household would face eviction if forced to pay minimum rent;',
          'The household income has decreased;',
          'There has been a death in the household; or',
          'Other applicable situations, as determined by HUD, have occurred.',
        ] },
        'When a tenant requests a financial hardship exemption, management must waive the minimum $25 rent charge beginning the month immediately following the request and implement the TTP calculated at the higher of 30% of adjusted monthly income or 10% of gross monthly income (or welfare rent). The TTP will not drop to zero unless those calculations all result in zero.',
        'Management will request reasonable documentation of the hardship to determine whether a hardship exists and whether it is temporary or long-term. Management will decide within one week of receiving the documentation.',
        'Management may not evict the tenant during the period of determination and during the 90-day suspension period, if applicable.',
        'If management determines the hardship to be long-term, the tenant will be required to recertify every 90 days.',
      ] },
      { k: 'ul', items: [
        'The unit must be the applicant’s ONLY residence.',
        'The applicant must not currently be receiving assistance at any other unit, at this or any other HUD-assisted property or under a PHA program, after the move-in date at this property (see III.F.6).',
      ] },
    ],
  },

  {
    id: 'income_limits', num: 'II', title: 'Income Limits / Economic Mix Requirements', blocks: [
      { k: 'h', text: 'Section 8 Income Limit' },
      { k: 'p', text: 'Eligibility depends on the income of the household as well as the income limits for the property. Income limits are published by HUD (usually annually) and are based on the county where the property is located and the number of persons in the household, with higher limits for larger families. The owner will include all persons living in the unit except live-in aides, foster children, foster adults, and guests. A copy of the current income limits can be found in the rental office.' },
      // Comment #39: the applicable limit (very-low 50% vs low 80%) is stated in
      // natural language from the initial HAP contract effective date.
      { k: 'choice', setting: 'incomeLimit' },

      { k: 'h', text: 'Section 8 Program — Targeting Requirements' },
      { k: 'p', text: 'At least 40% of the units that become available in each project fiscal year, together with initial certifications of in-place tenants, must be leased to extremely low-income families. An extremely low-income family is one whose income does not exceed the higher of 30% of Area Median Income or the federal poverty guideline (not to exceed the very-low-income limit), as published in HUD’s annual income limits (24 CFR 5.653(c)). Staff will use the extremely-low-income (ELI) column in the published income limits.' },
      { k: 'p', text: 'At the beginning of each quarter (January, April, July, October), a review of the property’s admissions will be made to confirm that the 40% target will be met using the current waiting list. This is done by looking at the vacancy rate over the last two years and the rate at which waiting-list applicants moved in, and comparing those with the percentage of waiting-list applicants at extremely low-income levels. If the manager can reasonably assume the 40% target will be met in the current fiscal year without a new procedure, residents may continue to be accepted in waiting-list order.' },
      { k: 'p', text: 'If the review shows the 40% target will not be met, the following method will be used:' },
      // Comment #46: three HUD methods + an "Other" free-text option.
      { k: 'choice', setting: 'incomeTargetingMethod' },
      { k: 'p', text: 'Any change to the property’s income-targeting procedure will be documented.' },
      { k: 'ul', items: [
        'If the owner actively markets to extremely low-income families but is unable to attract a sufficient number to lease 40% of available units during the year, the owner may rent to other eligible families after a reasonable marketing period.',
        'To market adequately, the owner must, at a minimum, advertise in the locality and conduct outreach to local organizations serving the extremely low-income population for no less than 30 days. If, after that period (with documentation of the marketing efforts), the owner is unable to attract eligible extremely low-income applicants, the owner may admit other eligible families. The owner must continue to advertise to extremely low-income applicants. Both the initial and ongoing marketing must comply with the Affirmative Fair Housing Marketing Plan (AFHMP).',
        'The owner must maintain records that demonstrate to HUD’s satisfaction that all reasonable steps were taken to fill these units with extremely low-income tenants.',
      ] },
    ],
  },

  {
    id: 'procedures', num: 'III', title: 'Procedures for Accepting Applicants and Selecting from the Waiting List', blocks: [
      { k: 'h', text: 'Application Taking' },
      { k: 'ul', items: [
        'Applications will be accepted in person, by U.S. mail, or by facsimile. Management will allow applications by any other secure method if necessary as a reasonable accommodation.',
        'Each application will be date- and time-recorded upon receipt.',
        'No application fee or screening fee will be charged to applicants.',
        'If an appropriate-size unit is not available at initial application, the applicant will be placed on the Master Waiting List. A letter will be sent notifying them of their placement and of their responsibilities to remain on the waiting list in active status.',
        'Processing of the application will take place when the applicant’s name has reached the top or near the top of the waiting list and an appropriate-size unit is expected to become available.',
        'A copy of this Tenant Selection Plan is available upon request to any applicant.',
        'Management will review this plan at least annually. Applicants on the waiting list will be notified in writing of any change that affects their eligibility, preference, or position on the list. The plan in effect at the time of the final eligibility determination will apply.',
      ] },

      { k: 'h', text: 'Violence Against Women Act (VAWA)' },
      { k: 'ul', items: [
        'Applicants for and residents of this property are protected by the Violence Against Women Act (VAWA). The “Notice of Occupancy Rights Under the Violence Against Women Act” (HUD-5380) will be given to every tenant upon move-in, as well as to any applicant who is denied assistance (or any tenant who is terminated), together with the “Certification of Domestic Violence, Dating Violence, Sexual Assault, or Stalking and Alternate Documentation” form (HUD-5382).',
        'VAWA protects current residents as well. Full details are in the HUD-5380. This property’s Emergency Transfer Policy is recorded in our “Emergency Transfer Plan” (HUD-5381) and is available upon request.',
        'Under VAWA, applicants who otherwise qualify cannot be denied admission or assistance because they have been a victim of domestic violence, dating violence, sexual assault, or stalking. This includes denials based on adverse factors (such as poor rental or credit history or a criminal record) that are a direct result of the victimization; management will consider whether such history was caused by the abuse (24 CFR 5.2005(b)). These protections apply to victims as well as members of their families.',
        'Management is not required to ask for documentation of the abuse but may request it in writing; if requested, documentation must be provided within 14 business days (management may extend this deadline). Any one of the following is acceptable: (1) form HUD-5382; (2) a document signed by an employee, agent, or volunteer of a victim service provider, an attorney, or a medical or mental health professional; (3) a police, court, or administrative record; or (4) at management’s discretion, a statement or other evidence. Management will make sure the safety of the applicant/resident comes first and will not allow the verification process to stand in the way of protecting a victim’s immediate safety.',
        'All information pertaining to incidents of domestic violence, dating violence, sexual assault, or stalking, including the tenant’s new location, will be kept strictly confidential and will not be entered into any shared database or provided to any entity unless the victim consents in writing, disclosure is required for an eviction or termination proceeding, or disclosure is otherwise required by law. Such documentation will be retained in a separate file kept in a separate secure location from other tenant files.',
        'Management may bifurcate a lease to evict, remove, or terminate the assistance of the offender while allowing the victim, who is a tenant or lawful occupant, to remain in the unit. If the person removed was the only eligible household member, the remaining members will be given the time provided in 24 CFR 5.2009 to establish eligibility or find other housing.',
        'VAWA does not guarantee assistance, nor does it prevent eviction where the applicant/resident does not meet other lease requirements unrelated to the violence committed against them. However, victims of violence will not be held to a more demanding set of rules than other tenants.',
        'Management will not penalize an applicant or resident for seeking law enforcement or emergency assistance on behalf of themselves or others (VAWA 2022, 34 U.S.C. 12495).',
      ] },

      { k: 'h', text: 'Form HUD-92006, Supplement to Application for Federally Assisted Housing' },
      { k: 'ul', items: [
        'Applicants must be given the opportunity to complete form HUD-92006. The form allows applicants to identify an individual or organization that management may contact and the reason(s) for contact. If the applicant chooses to provide the information, they must sign and date the form.',
        'Applicants currently on the waiting list who were not provided the opportunity must be given it at the time of admission.',
        'Management cannot require any applicant to provide the contact information; it is optional. Applicants who choose not to provide it should check the box indicating so and sign and date the form.',
        'Management should give applicants the opportunity at admission to update, remove, or change contact information provided at application, particularly if a long period has elapsed.',
        'If the applicant chooses more than one contact, they must make clear the reason each may be contacted; management should allow a separate form HUD-92006 for each contact. For example, the applicant may choose a relative for emergency purposes and an advocacy organization for assistance with tenancy.',
        'In order to determine eligibility and tenant payment amount, the income, assets, expenses, age, etc., of the applicant must be determined. The applicant must complete the full application and provide all information pertaining to eligibility.',
      ] },

      { k: 'h', text: 'Procedures for Leasing Vacant Units' },
      { k: 'p', text: 'While remaining in compliance with the income-targeting requirements in Section II.B above, vacant units will be leased in the following order (comment #70 ranking; 24 CFR 8.27, 4350.3 4-4 C.5):' },
      { k: 'ul', items: [
        'Any current household approved for a VAWA emergency transfer (see VI).',
        'Any current household approved for a transfer as a reasonable accommodation, including a household that needs the features of an accessible unit (see V and VI).',
        'Any current household whose unit has become uninhabitable through no fault of the household (see VI).',
        // Comment #71 / #70: displaced is an owner-adopted preference (a setting).
        { text: 'Any applicant verified as displaced (owner-adopted preference).', when: { flag: 'displacedPreference' } },
        'Any current household that is over-occupying a unit.',
        'Any current household that is under-occupying a unit.',
        'The first applicant on the waiting list, in order of preference (if any) and date and time of application.',
      ] },
      { k: 'p', when: { flag: 'displacedPreference' }, text: 'Displaced means a family or person who is displaced by government action, or whose dwelling has been extensively damaged or destroyed as a result of a disaster declared or otherwise recognized under federal disaster-relief laws. To qualify for this preference, the applicant must provide written verification of the displacement (for example, a letter on letterhead from the government agency, documentation that the dwelling has been condemned, or an oral verification completed by management and documented in the applicant file). Applicants will be told how to document the preference. If management determines an applicant does not qualify, the applicant will be notified in writing and may request a meeting under III.G.' },
      { k: 'p', text: 'Other preferences: {{otherPreferences}}' },

      { k: 'h', text: 'Waiting List Procedures' },
      { k: 'ul', items: [
        'There will be one master waiting list for the property; additional sub-lists may be maintained (for example, Barrier-Free or In-House Transfers). When an apartment is expected to become available (e.g., when a thirty-day notice to move out is submitted), the applicant at the top of the waiting list will be contacted (or another appropriate applicant per the income-targeting requirements in Section II.B).',
        'Management will attempt to contact the applicant by telephone at least three times during the next 48-hour period. If contact cannot be made by telephone, a letter will be sent by certificate of mailing requesting a date and time for an interview. If there is no response within ten business days from the date of the letter, the applicant forfeits the opportunity to apply for the available unit but remains at the top of the applicable waiting list. Before removing an applicant for failure to respond, management will also attempt to reach any contact person or organization listed on form HUD-92006.',
        'When a second unit becomes available, the same process occurs. If the applicant does not respond to the second letter, they will be placed in the inactive file and a letter sent by certificate of mailing informing them that their name has been removed from the waiting list.',
        'If a contacted person refuses an available unit, they remain at the top of the applicable waiting list; however, a letter will be sent within 48 hours informing them that after the third refusal their name will be removed and placed in the inactive file. A refusal for good cause (for example, a disability-related reason, a unit lacking accessibility features the household needs, or a documented medical or safety reason) will not be counted as a refusal.',
        'When an interview is set but the applicant fails to appear and does not contact management within 24 hours of the appointment, management will send one written notice offering a rescheduled appointment; if the applicant misses the rescheduled appointment without good cause, the applicant will be removed from the waiting list and placed in the inactive file.',
        'All waiting lists will be updated at least annually. Management will attempt to contact each applicant, by phone or in writing, to confirm continued interest. Applicants failing to respond within fourteen business days will be removed and placed in an inactive file. They may reapply when the list is open but will not keep their old position and will be treated as new applicants. It is the applicant’s responsibility to notify management in writing of any changes in phone number, address, or household composition.',
        'An applicant removed in error, or who could not respond because of a disability, will be reinstated to their original place on the waiting list (4350.3 4-21).',
        'If an applicant’s household composition changes while on the waiting list, the applicant will be moved to the waiting list for the appropriate unit size and will keep the original application date and time.',
        'An applicant may be on more than one unit-type waiting list if they qualify for more than one unit type. The date of initial application determines their place on the list.',
        'Each applicant will be notified promptly of the disposition of their application. If placed on the waiting list, the applicant will be sent a letter stating that they are on the list pending a full eligibility determination and screening, and will remain until an appropriate unit becomes available.',
        'Applications, HUD-92006 forms, rejection notices, applicant responses, and management’s final responses for applicants who are removed or rejected will be kept for at least three years (4350.3 4-22).',
      ] },

      { k: 'h', text: 'Opening and Closing the Waiting List' },
      { k: 'ul', items: [
        'The waiting list will be closed for one or more unit sizes when the average wait is one year or more, based on the average turnover for that unit size over the past two years.',
        'Management will advise potential applicants that the waiting list is closed and refuse to take additional applications. Applications received while the list is closed will not be placed on the list.',
        'When the waiting list is closed, a notice will be published in a publication likely to be read by potential applicants, stating the unit size(s) affected, the reason, and the effective date, and will also be posted in the rental office.',
        'The waiting list will re-open when the wait time is estimated to be less than one year.',
        'When management agrees to accept applications again, the notice of action will be announced in accordance with our AFHMP. We will work with the groups and organizations listed in the AFHMP to ensure they are properly informed of housing opportunities.',
        'Notice of the opening of the waiting list will include the rules for applying, the order in which applications will be processed, and where and when to apply.',
      ] },

      { k: 'h', text: 'Applicant Screening Criteria' },
      { k: 'p', text: 'Criminal: A criminal background check will be completed on all adult members of the applicant family (18 years of age and older, including live-in aides). The results of this check will be used to determine whether the applicant will be accepted into the community.' },
      // Comment #101: only the applicable state module is generated. NJ → Fair
      // Chance in Housing Act (below); other states → the standards below.
      { k: 'p', text: 'For this New Jersey property, the timing and scope of the criminal history check are governed by the Fair Chance in Housing Act, as described below.', when: { state: ['nj'] } },
      // Comment #94: the 3-year drug-eviction bar is an optional property setting.
      { k: 'p', text: 'Drug-Related Activity: Any household containing a member who was evicted in the last three years from federally assisted housing for drug-related criminal activity will be prohibited from admission (subject to the exceptions below).', when: { flag: 'drugEvictionBar' } },
      // Comment #92: keep as is, but do not name New Jersey as the example.
      { k: 'p', text: 'Drug Use: A household in which any member is currently engaged in illegal use of drugs, or for which the owner has reasonable cause to believe that a member’s illegal use or pattern of illegal use of a drug may interfere with the health, safety, and right to peaceful enjoyment of the property by other residents, will be prohibited from admission. Illegal drug use is determined under federal law. Marijuana use that is not authorized under federal law, including adult-use (recreational) marijuana permitted by state law, is illegal drug use for this purpose. For state-licensed medical marijuana, management will follow HUD’s current guidance.' },
      { k: 'p', text: 'Sex Offender: Any household member who is subject to a State Sex Offender lifetime registration requirement, in any state, will be prohibited from admission. Management will use the Dru Sjodin National Sex Offender Website (which may be accessed through the property’s screening software) to determine whether any household member is subject to a lifetime registration requirement, checking the state where the property is located and the other states where household members are known to have resided (24 CFR 5.905).' },
      { k: 'p', text: 'Alcohol: If there is reasonable cause to believe that any household member exhibits negative behavior, from abuse or a pattern of abuse of alcohol, that may interfere with the health, safety, and right to peaceful enjoyment by other residents, the household will be prohibited from admission. (This screening condition will be based on behavior, not on the condition of alcoholism or alcohol abuse.)' },
      { k: 'p', text: 'For drug and alcohol activity, exceptions will be made if the household member has successfully completed an approved, supervised drug rehabilitation program (so long as the applicant can provide proper documentation that they completed the program), or the circumstances leading to the eviction no longer exist (for example, the household member no longer resides with the applicant household).' },
      { k: 'p', text: 'In addition to the above criteria, management has established additional criteria by which it will determine admission into the property. Under 24 CFR 5.852 and 5.855, management may consider all relevant circumstances when screening, and the Fair Housing Act continues to apply. Accordingly, our screening criteria set objective standards to avoid discrimination while taking a wide array of factors into account to avoid any disparate impact on individuals of a race, national origin, or other protected class. The key factor in denying assistance is whether an applicant represents a dangerous rental risk. Our screening criteria are set to achieve a substantial, legitimate, nondiscriminatory interest. To this end the following guidelines will be in place:' },
      // Comment #98: the "arrests considered as one factor" stance is a property setting.
      { k: 'p', text: 'Arrests with no conviction will not automatically make an applicant unqualified for acceptance. Arrests could be made for many reasons, from unpaid parking tickets to peaceful protests, and an arrest alone does not mean the applicant was ever guilty of a crime.', when: { flag: 'arrestsAsFactor' } },
      { k: 'ul', items: [
        'The amount of time since a conviction will be considered. People change over time, and a conviction many years ago does not make an applicant a “dangerous rental risk.”',
        'Patterns of offense will be considered strongly. If an applicant has a pattern of reoffending, we have good reason to believe we may encounter a safety risk.',
        'The severity of the crime will be considered. A nonviolent crime factors differently than a violent one, and our criteria flag only those crimes that pose a dangerous rental risk. Even within a type of crime, our criteria differentiate between high and low degrees of severity, and the level of the conviction is considered (a felony is more severe than a misdemeanor).',
        'Our criteria and process for criminal-related activity will be the same for any applicant regardless of race, national origin, or another protected characteristic.',
        'When an applicant is flagged, an individualized assessment of relevant mitigating information beyond the criminal record will be made. This includes the age of the individual, tenant history before and after the conviction, evidence of rehabilitation, the circumstances surrounding the crime, and the extent to which the applicant household has taken responsibility and taken all reasonable steps to prevent or mitigate the offending action.',
      ] },
      { k: 'p', text: 'If a member of the applicant’s household is not eligible due to criminal activity, management will allow the household to exclude that member from the household and approve the remaining members.' },

      // ===== Option A — New Jersey only (comment #101) =====
      { k: 'h', text: 'Criminal History Screening — Fair Chance in Housing Act', when: { state: ['nj'] } },
      { k: 'ul', when: { state: ['nj'] }, items: [
        'Before a conditional offer, management will not ask about or consider any criminal history, except (i) whether any household member is subject to a lifetime sex-offender registration requirement and (ii) whether any household member has been convicted of manufacturing or producing methamphetamine on the premises of federally assisted housing. The application will state that a criminal history check will be conducted only after a conditional offer, and the Division on Civil Rights’ Fair Chance in Housing disclosure notice will be given to every applicant with the application.',
        'When the household has met all other eligibility and screening criteria, management will issue a written conditional offer. Only then will the criminal history check be run.',
        'After the conditional offer, management may consider only: (i) a conviction for murder, aggravated sexual assault, kidnapping, arson, human trafficking, sexual assault, or endangering the welfare of a child, as specified in N.J.A.C. 13:5-1.8(b), or any conviction that requires lifetime sex-offender registration (no time limit); (ii) a first-degree indictable offense within the past 6 years; (iii) a second- or third-degree indictable offense within the past 4 years; and (iv) a fourth-degree indictable offense within the past 1 year. Each period is measured from the date of conviction or the date of release from prison for that offense, whichever is later.',
        'Management will not consider: arrests or charges that did not result in a conviction; expunged, pardoned, vacated or otherwise legally nullified convictions; juvenile adjudications of delinquency; sealed records; or any offense not listed above, including disorderly-persons and petty-disorderly-persons offenses.',
        'The federal standards above continue to apply. Any part of those standards that depends on criminal history information, other than the two permitted pre-offer questions, will be applied only after the conditional offer.',
        'If the check shows a considerable offense, management will give the applicant a copy of the report and an opportunity to provide evidence of inaccuracies, rehabilitation or other mitigating factors before deciding. Management may withdraw the conditional offer only if, after an individualized assessment, it determines by a preponderance of the evidence that withdrawal is necessary to fulfill a substantial, legitimate, nondiscriminatory interest. The assessment will consider: the nature and severity of the offense; the applicant’s age at the time of the offense; how long ago it occurred; any evidence of rehabilitation and good conduct since; whether a recurrence would affect the safety of other residents or the property; and whether the offense occurred on, or was connected to, property the applicant rented or leased.',
        'Any withdrawal will be made in writing, using the Division on Civil Rights’ notice-of-withdrawal form or an equivalent notice, stating the specific reasons and the applicant’s right to appeal with additional evidence. The applicant may, within 30 days of the notice, request all information management relied on, including the criminal record; management will provide it free of charge within 10 days of the request. Management will reconsider and issue a written determination on any appeal within 30 days. The rejection procedures in III.G also apply.',
        'Management will confirm that its screening vendor’s criminal report for this property contains only the information permitted above.',
      ] },

      // ===== Option B — all other states (comment #101) =====
      { k: 'h', text: 'Criminal History Standards', when: { state: ['other'] } },
      // Comment #103/#104: allow upload of the provider's screening criteria; the
      // generic OneSite-style list is the fallback when none is uploaded.
      { k: 'upload', setting: 'screeningCriteria', when: { state: ['other'] }, fallback: [
        { k: 'p', text: 'Our screening system searches multiple federal, state, and local registries for records of conviction. Each category is divided into “high” and “low” level convictions and “felony” and “misdemeanor” convictions, and returns a result of “fail,” “pass,” or “conditional.” Each category has the look-back period listed below, measured from the date of conviction or release from incarceration, whichever is later; anything earlier will be ignored:' },
        { k: 'ul', items: [
          'Violent felonies (including weapons offenses involving violence or threats to persons): {{lookbackViolentFelony}} years',
          'Felony drug-related criminal activity (manufacture, distribution, or possession with intent to distribute): {{lookbackFelonyDrug}} years',
          'Other felonies that would threaten the health, safety or property of residents or staff: {{lookbackOtherFelony}} years',
          'Misdemeanors involving violence, threats, weapons, or damage to property: {{lookbackMisdViolent}} years',
          'Other misdemeanors that would threaten the health, safety or peaceful enjoyment of residents: {{lookbackOtherMisd}} years',
        ] },
        { k: 'p', text: 'The categories reviewed include: Property-Related, Animal-Related, Violence-Related, Fraud-Related, Computer/Telecommunications-Related, Family-Relations-Related, Public-Justice-Related, Public-Order-Related, Gambling-Related, Weapons-Related, Organized-Crime-Related, Drug-Related, Sex-Related, Transportation-Related, and Alcohol-Related crimes.' },
      ] },
      { k: 'p', text: 'Only offenses within these categories that are drug-related criminal activity, violent criminal activity, or other criminal activity that would threaten the health, safety or right to peaceful enjoyment of the premises by other residents, or the health or safety of management staff, and that fall within the look-back periods above, will be grounds for denial (24 CFR 5.855). All such denials are subject to the individualized assessment above.', when: { state: ['other'] } },

      { k: 'p', text: 'Criminal activity after move-in is addressed by the Lease and House Rules and will be handled in accordance with 24 CFR 5.858–5.861 and VAWA.' },
      { k: 'p', text: 'Live-in aides will be screened under the criminal, drug, alcohol, sex-offender and rental-conduct standards in this section, but not for credit or rent-payment history, because live-in aides are not responsible for paying rent.' },

      { k: 'h', text: 'Credit' },
      { k: 'p', text: 'A credit check will be obtained for each adult member of the applicant’s family who is eighteen (18) years of age or older, without charge to the applicant. The credit report will be reviewed to determine the history of payment practices, including utilities, outstanding loans, judgments, bankruptcies, and foreclosures. Applicants will not be rejected for lack of credit history but may be rejected for poor credit history.' },
      // Comment #119: allow upload of the provider's credit criteria; keep the
      // generic (objective, rent/utility-focused) language as the fallback.
      { k: 'upload', setting: 'creditCriteria', fallback: [
        { k: 'p', text: 'Management will look primarily at the credit history for the past {{creditLookbackYears}} years. Where a poor-credit event is significant, management will consider up to 10 years of credit history. “Poor credit history” means an unpaid balance owed to a prior landlord (including another HUD-assisted property or a PHA) or to a utility provider of more than {{creditUnpaidThreshold}}, or a rent-related judgment within the past {{creditLookbackYears}} years. Medical debt, student loans, and debts discharged in bankruptcy will not be counted.' },
      ] },
      { k: 'p', text: 'Management uses industry-standard, licensed screening software to obtain credit and information profiles (public records, NSF (returned) check information, Social Security Number verification, delinquencies, and apartment address cross-referencing). The screening software obtains information from several databases including, but not limited to, the national consumer reporting agencies (for example, TransUnion, Equifax and Experian) and the screening vendor’s public-record and check-verification sources.' },
      { k: 'p', text: 'If an application is rejected wholly or partly because of information in a consumer report (a credit, criminal or eviction report from a screening company), the rejection notice will give the name, address and telephone number of the consumer reporting agency, state that the agency did not make the decision, and explain the applicant’s right to a free copy of the report within 60 days and to dispute its accuracy (Fair Credit Reporting Act, 15 U.S.C. 1681m). Management will reappraise a credit report forwarded to management by the credit bureau on the applicant’s behalf that reflects corrections or additions made as a result of action taken directly by the applicant with the credit bureau and/or creditor. In such a case the applicant will be reinstated to their original position on the waiting list. The application and eligibility are considered rejected until updated information is received from the credit agency.' },

      { k: 'h', text: 'Rental History' },
      { k: 'ul', items: [
        'References will be obtained from present and past landlords to determine (1) credit history (whether the applicant pays rent on time) and (2) housekeeping and general tenant behavior.',
        'An applicant may be rejected if these reports document failure to make payments. Verifiable rental history includes a copy of the applicant’s rental agreement showing the monthly rent due, copies of cancelled checks or payment receipts, and a completed Landlord Verification form signed by the current landlord and any additional landlords. Applicants whose history shows a late-payment record of more than ten days past due on two or more occasions over the past year, as verified by landlords or court records, will be rejected based on poor rental practices. Lack of rental history alone will not be reason for rejection, but poor rental history will.',
        'An applicant may be rejected if the landlord verification form shows the applicant, the applicant’s family and/or guests have poor housekeeping habits posing a threat to the health, safety and welfare of household members or other residents. Management will try to determine whether, in past rentals, the applicant permitted unauthorized persons to live in the unit, created physical hazards (for example, storing gasoline in the unit or discharging a firearm on the property), interfered with the rights and quiet enjoyment of other residents (threatening or attacking neighbors, vandalism, theft, drug activity, police activity, or abuse of a spouse or family member), provided false information during the rental process, or committed other lease violations. Management will not hold against an applicant who is a victim of domestic violence, dating violence, sexual assault or stalking any negative history that resulted from that abuse, including police calls or property damage caused by the abuser.',
        'When considering rental history, management will rely more heavily on former-landlord references than on current ones, because a current landlord may be tempted to give a good reference for a bad tenant so that the tenant will leave.',
      ] },
      { k: 'p', text: 'Mitigating circumstances: For credit and rental history, as for criminal history, management will consider information the applicant provides about mitigating or extenuating circumstances (for example, a temporary loss of income, a medical emergency, or a since-repaid debt). If the circumstances relate to a disability, management will consider them as a reasonable accommodation. A unit will not be offered where the tenancy would pose a direct threat to the health or safety of others that cannot be eliminated by a reasonable accommodation.' },
      { k: 'p', text: 'If a negative credit report or criminal report is received at any time after the initial approval of the applicant’s credit and criminal reports, the applicant will be notified in writing that, under the above guidelines, the application and eligibility are rejected.' },

      { k: 'h', text: 'Verification' },
      { k: 'ul', items: [
        'Verification of all eligibility requirements — including income, assets, expenses, deductions, family characteristics and circumstances that affect eligibility or the level of assistance — will be required from third parties for all applicants. All documentation must be current (within 120 days of move-in).',
        'Management will require the household to sign consent release forms so that documentation may be obtained. If the household fails to sign the requested consent release forms, the application will be declined. If the verification documentation is not received, the move-in will be postponed until it is received, and the next qualified applicant will be processed for the available unit.',
      ] },
      { k: 'p', text: 'The order of verification acceptability is:' },
      { k: 'ul', items: [
        { text: 'Upfront Income Verification (UIV), such as the Work Number system. Because this may involve an additional cost to the property, management may decide not to use a UIV.' },
        { text: 'Third-party verification from the source (written). This can be either:', sub: [
          'written documentation sent directly by the third-party source (by mail or electronically); or',
          'a complete, current, and unaltered document from the source provided by the tenant (for example, pay stubs or bank statements).',
        ] },
        { text: 'When the income information provided is not supported by, or is challenged by, the EIV income report, or there is incomplete EIV data, written third-party verification from the source must be attempted first.' },
        { text: 'Oral third-party verification from the source, documented in the file. When verifying over the phone, the manager will document the third party’s name, position and contact information, the information reported, the name of the person conducting the interview, and the date and time of the call.' },
        { text: 'Family certification — for example, a notarized statement or affidavit (or one witnessed by the manager) regarding the veracity of information submitted. This form of verification will be accepted only if the information cannot be verified by another acceptable method. Management will document why the information was not available through other methods, or will maintain a date-stamped copy of the original request sent to the third party together with written notes documenting follow-up efforts.' },
      ] },
      { k: 'p', text: 'If an applicant is found to have willfully lied on their application, they will be denied. Living in an affordable-housing property requires the utmost honesty, especially regarding income information, and an attempt to defraud HUD will not be tolerated.' },
      { k: 'p', text: 'In accordance with HUD regulation, all applicants and existing tenants will be informed during the application/recertification process that information will be gathered using the Enterprise Income Verification (EIV) system, a web-based system containing employment, income, and benefits information on individuals participating in HUD’s rental-assistance programs.' },
      { k: 'p', text: 'The EIV “Existing Tenant Search” report will be run at the time an application is processed for admission and identifies who may be receiving assistance at another Multifamily, Public Housing or Housing Choice Voucher location. Each person on the application will be screened and the report kept in the applicant file. If a match is found, the tenant and current housing provider will be contacted to coordinate the move-out and move-in dates. Move-in at the new location may not take place prior to the move-out at the old one.' },
      // Comment #130: dual-subsidy termination clause.
      { k: 'p', text: 'If a tenant moves in before being moved out of their previous assisted unit, a Dual Subsidy (DS) termination will be processed, and the tenant will be responsible to pay market rent for the overlapping (terminated) days.' },
      { k: 'p', text: 'The EIV “Income Reports” will be run to help determine and verify income, Social Security (SS) benefits, Supplemental Security Income (SSI) benefits, and Dual Entitlement SS benefits, and to continually monitor the accuracy and level of assistance of all new and existing tenants. Income reports will be pulled for new move-ins within 90 days of the certification being submitted to TRACS.' },
      { k: 'p', text: 'All applicants will be given the “EIV & You” brochure outlining the use of EIV during the certification process. (Existing tenants will be issued a copy during the recertification process.)' },

      { k: 'h', text: 'Application Rejection' },
      { k: 'p', text: 'Applications can be rejected if they are ineligible based on HUD and/or community rules and guidelines. This includes, but is not limited to:' },
      { k: 'ul', items: [
        'Failure to meet any HUD eligibility requirement regarding income limits, family/household definition and composition.',
        'Refusal to occupy the proper unit size in accordance with HUD/management unit-size standards.',
        'Refusal to fill out and sign any of the required forms and letters.',
        'Any household member not meeting the criminal, drug, alcohol or sex-offender standards in III.E (for this property, only as permitted by the applicable state module).',
        'Failure to meet the credit standard in III.E.',
        'A landlord reference reporting poor tenant behavior.',
        { text: 'If the property has a no-pet policy (see house rules) and the applicant refuses to occupy the apartment without pets. Assistance animals for persons with disabilities are not pets and are never a reason for rejection.', when: { demo: ['family'] } },
        'Refusal to pay the rent calculated using HUD’s rules.',
        'The apartment will not be the applicant’s only place of residence.',
        'Failure to move into the rent-ready unit on the agreed-upon date.',
        'Any household member who has committed fraud in connection with any federal housing assistance program, or has been evicted from federal housing for drug-related criminal activity within the last three years (subject to the exceptions in III.E).',
      ] },
      { k: 'p', text: 'Applicants who are rejected will be notified in writing with a list of the reason(s) for the rejection, and advised that they have fourteen days to respond in writing or to request a meeting to discuss or appeal the rejection. The notice will also state that persons with disabilities may request a reasonable accommodation to participate in this process. Meeting with management in no way implies the rejection will be overturned. If the applicant appeals, a member of the management company other than the one who made the initial rejection will review the disputed case. The applicant will be notified in writing of the decision within five business days of the meeting or of receipt of the written response. If still not satisfied, the applicant may contact the local HUD office.' },
      { k: 'p', text: 'Before denying admission based on a criminal record or sex-offender registration information, management will notify the household of the proposed denial, provide the subject of the record and the applicant with a copy of the record, and give them an opportunity to dispute its accuracy and relevance, consistent with 24 CFR 5.903(f) and 5.905(d). When the decision is based in whole or part on a consumer report, the notice will also include the Fair Credit Reporting Act disclosures described in III.E.' },
      { k: 'p', text: 'If an applicant is rejected, they will be sent a copy of the HUD-5380 “Notice of Occupancy Rights under the Violence Against Women Act” and the HUD-5382 “Certification of Domestic Violence, Dating Violence, Sexual Assault, or Stalking and Alternate Documentation” form.' },
      { k: 'p', text: 'Rejected applicants may re-apply when the waiting list is open, once the household’s circumstances have changed so as to remove the original reason(s) for rejection. (The household-member exclusion and credit-report correction provisions in III.E allow immediate reconsideration in the situations they describe.)' },
      { k: 'p', text: 'Applicants will not be rejected on the basis of race, color, creed, religion, sex, perceived or actual sexual orientation, gender identity, national origin, ancestry, age (except as permitted by the property’s HUD-approved elderly occupancy designation), handicap or disability of any person, familial or marital status, use of a service or assistance animal by a person with a disability, status as a handler or trainer of a service animal, source of lawful income, or any other characteristic protected by state or local law, or because of the handicap or disability of an individual with whom the person is known to have a relationship or association.' },
      { k: 'p', text: 'For this New Jersey property, the protected characteristics above also include nationality, pregnancy or breastfeeding, gender identity or expression, domestic-partnership or civil-union status, and liability for service in the Armed Forces.', when: { state: ['nj'] } },
      { k: 'p', text: 'No inquiries for the purpose of determining eligibility will be made about sexual orientation or gender identity. Lawful inquiries about an applicant/occupant’s sex may be made for the purpose of determining the number of bedrooms to which a household may be entitled.' },
    ],
  },

  {
    id: 'occupancy', num: 'IV', title: 'Occupancy Standards', blocks: [
      { k: 'h', text: 'Unit Size' },
      { k: 'p', text: 'The unit size will be selected based on household composition and size, as follows:' },
      { k: 'table', id: 'unitSize' },
      { k: 'p', text: 'The property assumes a general standard of two people per bedroom but will allow one occupant per bedroom if the applicant requests it based on their specific needs. This includes spouses, parents and children, and siblings who wish to keep separate bedrooms.' },
      { k: 'p', text: 'Live-in aides (and any family members of the aide whom management approves to reside in the unit), foster children, foster adults, and the persons listed below are counted when determining unit size. An additional bedroom needed because of a disability (for example, for a live-in aide or for medical equipment) will be provided as a reasonable accommodation when the need is verified. These standards will not be more restrictive than applicable state or local occupancy codes.' },
      // Settable years + removable entirely (some properties allow no non-mandated transfers).
      { k: 'p', when: { notFlag: 'noSmallerUnitHold' }, text: 'Applicants who qualify for two different-sized units (for example, two persons who qualify for both a one-bedroom and a two-bedroom unit) and choose to move into the smaller unit will not qualify for a transfer to the larger unit for {{smallerUnitHoldYears}} years from their date of move-in if their family size remains the same. At the end of that period, the family may request to be placed on the Transfer Waiting List for the next unit size.' },
      { k: 'p', text: 'When determining family size for establishing income eligibility, management will include all people living in the unit except for:' },
      { k: 'ul', items: [
        'Guests.',
        { text: 'Live-in aides.', sub: [
          'A live-in aide is someone who resides with one or more elderly or near-elderly persons, or with a person with a disability, who is essential to the care and well-being of the person, is not obligated for the support of that person, and would not be living in the unit except to provide necessary supportive services.',
          'Management will verify the need for the live-in aide from the applicant’s physician, psychiatrist, other medical practitioner, health-care provider, or other reliable third party in a position to know about the disability-related need. Management will not require access to confidential medical records or require the applicant to submit to a physical examination.',
          'A live-in aide does not qualify for continued occupancy as a remaining family member, and only qualifies as a live-in aide so long as the supportive services are required by the tenant.',
          'Expenses for services provided by the live-in aide, including medical care (such as dispensing medication) and personal care (such as bathing or dressing), are considered eligible medical expenses if not reimbursed. Homemaker services such as housekeeping and meal preparation are not.',
          'A relative may be considered a live-in aide if they meet the above requirements.',
        ] },
        'Foster children and foster adults (counted for unit size but not for income limits).',
      ] },
      { k: 'p', text: 'The following persons who do not currently live in the unit are counted in family size for both income limits and unit size:' },
      { k: 'ul', items: [
        'Children expected to be born to a pregnant woman.',
        'Children in the process of being adopted.',
        'Children whose custody is being obtained.',
        'Children of the family who are temporarily placed in foster care and will be returning to the family.',
        'Children in joint-custody arrangements who are present in the household 50% or more of the time.',
        'Children away at school who live with the family during school recesses.',
      ] },
    ],
  },

  {
    id: 'accessible', num: 'V', title: 'Accessible Units', blocks: [
      // Comment #150: whether the property has accessible units is a setting; if
      // not, the whole assignment policy is replaced by a single statement.
      { k: 'p', text: 'There are no accessible units at this property.', when: { notFlag: 'hasAccessibleUnits' } },
      { k: 'p', when: { flag: 'hasAccessibleUnits' }, text: 'This property has {{accessibleMobilityCount}} mobility-accessible unit(s) and {{accessibleHearingVisionCount}} hearing/vision-accessible unit(s).' },
      { k: 'h', text: 'Accessible Unit Assignment', when: { flag: 'hasAccessibleUnits' } },
      { k: 'p', when: { flag: 'hasAccessibleUnits' }, text: 'For units accessible to people with mobility, visual or hearing impairments, households containing at least one person with such an impairment have priority for those designated accessible units. Units with mobility features will be offered to households that need mobility features, and units with hearing or vision features to households that need those features. When the need for the features is not obvious or already known, management will verify that a household member has a disability-related need for them through a qualified third party (for example, a medical professional, service provider or other reliable source); management will not require medical records or a diagnosis. These accessible units will be filled as follows:' },
      { k: 'ul', when: { flag: 'hasAccessibleUnits' }, items: [
        'A current household containing at least one person with a disability who requires the special features of the accessible unit.',
        'If no current household requires the features, the unit will be offered to the next qualified applicant on the Waiting List requiring those features.',
        'If no qualified applicant on the Waiting List requires the special features, the unit will be offered to the next qualified applicant not requiring them. If that applicant accepts, they will execute a statement agreeing to vacate the unit and move to a non-accessible unit when a person requiring the special features qualifies. The household must move within 30 days after written notice that a suitable non-accessible unit is available. The cost of transfer will be the responsibility of the person who moved into the accessible unit; no costs of transfer will be borne by management or the owner.',
        'If the household member who needed the accessible features no longer resides in the unit, the remaining household members may be required to transfer to an appropriate non-accessible unit when one becomes available, on the same terms. No costs of transfer will be borne by management or the owner.',
      ] },
    ],
  },

  {
    id: 'transfer', num: 'VI', title: 'Transfer Policy and Procedure', blocks: [
      { k: 'h', text: 'Transfer Policy' },
      { k: 'p', text: 'HUD requires residents to transfer to a larger or smaller unit because of family size/composition:' },
      { k: 'ul', items: [
        'Over-utilization: more persons currently live in the unit than the number allowed under our Occupancy Standards.',
        'Under-utilization: fewer persons currently live in the unit than the number allowed under our Occupancy Standards.',
      ] },
      { k: 'p', text: 'A change in family size/composition that does not result in over- or under-utilization will not be given preference for transfer. The household may, on request, be placed at the bottom of the waiting list for the new unit size for which it now qualifies.' },
      // Comment #158: how the property handles non-mandated / in-house transfers
      // and ranks them against new applicants is a per-property choice.
      { k: 'choice', setting: 'inHouseTransferPolicy' },
      // Procedure for sharing vacancies, only when non-mandated transfers are allowed.
      { k: 'choice', setting: 'transferAlternation', when: { choiceEq: { setting: 'inHouseTransferPolicy', value: 'transfer_list' } } },
      { k: 'ul', items: [
        'If, through no fault of the tenant, a unit becomes unfit for use (for example, fire or flood), the tenant may be placed in an available vacant unit ahead of the waiting list.',
        'If a resident qualifies for an optional transfer and does not want to transfer when the unit is available, their name will be placed at the bottom of the transfer list. If the transfer is mandated by HUD, refusal to move will be cause for termination of subsidy, and the resident will be required to pay the current approved market rent for the unit they occupy.',
      ] },
      { k: 'h', text: 'Reasonable-Accommodation Transfers' },
      { k: 'ul', items: [
        'Management will approve a transfer requested as a reasonable accommodation when a household member with a disability has a disability-related need for it, unless the transfer would impose an undue financial and administrative burden or fundamentally alter the program.',
        'In-house transfers due to reasonable accommodation for current resident households will be housed before applicants on the Waiting List.',
        'Residents requesting reasonable-accommodation transfers must meet the other criteria of the Transfer Policy, except that management will consider waiving a criterion (such as an outstanding balance or the unit-condition requirement below) as a further reasonable accommodation when that criterion would prevent a disability-related move.',
        'When the disability or disability-related need is not obvious or already known, management may ask for verification from a qualified third party (for example, a doctor or other medical professional, a peer support group, a non-medical service agency, or another reliable third party in a position to know) that the household member has a disability and needs the requested transfer. Management will not ask for a diagnosis or medical records.',
        'If a tenant is transferred as a reasonable accommodation, the owner must pay the cost associated with the transfer, unless doing so would be an undue financial and administrative burden.',
      ] },
      { k: 'h', text: 'VAWA Emergency Transfers' },
      { k: 'ul', items: [
        'Per the property’s Emergency Transfer Policy, residents who are victims of domestic violence, dating violence, sexual assault, or stalking may be transferred for their protection and that of their family. Full details are in the HUD-5380, provided to every resident at move-in (and to any tenant who is evicted or applicant who is denied subsidy). The property’s Emergency Transfer Plan (HUD-5381) is available on request.',
        'A tenant qualifies for an emergency transfer if the tenant expressly requests it and either (a) reasonably believes there is a threat of imminent harm from further violence if they remain in the unit, or (b) is a victim of sexual assault that occurred on the premises within the 90 days before the request (24 CFR 5.2005(e)). Emergency-transfer requests are not subject to the good-standing and unit-inspection requirements below.',
        'To request a transfer under VAWA, the tenant must first make a formal written request to management. The HUD-5383 “Emergency Transfer Request” form may be used; it is provided at move-in and available at the office at any time.',
        'Management may ask for documentation of the domestic violence, dating violence, sexual assault or stalking in the manner described in the VAWA provisions of III.A; any one of the forms of documentation listed there is sufficient. The HUD-5382 certification form will be provided with instructions. Applicants/tenants do not need to use this form. Management will make sure the safety of the applicant/resident comes first and will not allow the verification process to stand in the way of protecting a victim’s immediate safety.',
        'All information pertaining to incidents of domestic violence, dating violence, sexual assault, or stalking, including the tenant’s new location, will be kept strictly confidential and will not be entered into any shared database or provided to any entity unless the victim consents in writing, disclosure is required for an eviction or termination proceeding, or disclosure is otherwise required by law.',
        'Management may bifurcate a lease to evict, remove, or terminate the assistance of the offender while allowing the victim, who is a tenant or lawful occupant, to remain in the unit.',
        'Due to availability, management cannot guarantee an immediate transfer, but will work as quickly as possible to move a tenant who is a victim. If a tenant reasonably believes a proposed transfer would not be safe, they may request a transfer to a different unit. Emergency transfers have priority over all other in-house transfers and over applicants on the waiting list.',
        'If no units are available, management will assist the tenant in identifying other housing providers with safe, available units, and, at the tenant’s request, in contacting local or national organizations that assist victims.',
        'Management will keep a complete log of all information pertaining to VAWA transfers, including the number of requests received, resolved, and pending, and the outcomes of all requests. These records will be kept for at least three years and reported to HUD as required (24 CFR 5.2005(e)).',
      ] },
      { k: 'h', text: 'Transfer Procedure' },
      { k: 'ul', items: [
        'The resident must complete a Transfer Request form. The original is kept in the resident’s file and a copy is given to the resident.',
        'The resident must be in good standing and have no balances due on their account. This and the unit-inspection requirement below do not apply to VAWA emergency transfers, transfers required by management (over/under-housed households and accessible-unit moves), or transfers needed because the unit is uninhabitable, and may be waived as a reasonable accommodation.',
        'When the transfer request is received, the Property Manager will complete a unit inspection of the resident’s current unit. The results must be satisfactory (no resident-related damages, and the unit maintained in a safe and sanitary condition).',
        'If the inspection is unsatisfactory, the transfer request will be denied until the unit is brought up to a satisfactory condition.',
        'Copies of the unit-inspection report and notice-of-inspection letter must be maintained in the resident’s file.',
        'When the transfer takes place, the security deposit on the previous unit will be transferred to the new unit. The resident is responsible for any damage charges on the previous unit.',
        'On the scheduled transfer date, the Property Manager will perform a move-in unit inspection with the resident. A signed copy of the inspection report is kept in the resident’s file and a copy is given to the resident.',
      ] },
    ],
  },

  {
    id: 'section504', num: 'VII', title: 'Section 504 — Fair Housing / Civil Rights / Equal Access', blocks: [
      { k: 'p', text: 'This property is an Equal Housing Opportunity community. It adheres to all federal Fair Housing and Civil Rights laws, all state and local non-discrimination regulations, and all equal-opportunity requirements in HUD administrative procedures, including the applicable state Fair Housing acts.' },
      { k: 'p', text: 'This property does not discriminate based on race, color, creed, religion, sex, sexual orientation, gender identity, national origin, ancestry, age (except as permitted by the property’s elderly occupancy designation), handicap or disability of any person, familial status, marital status, source of lawful income, use of a service or assistance animal by a person with a disability, status as a handler or trainer of a service animal, or because of the handicap or disability of an individual with whom the person is known to have a relationship or association. The property strictly adheres to these anti-discrimination laws, and the owner agrees that the property will be listed, shown, leased and managed in accordance with them.' },
      { k: 'p', text: 'This property does not discriminate against any socio-economic class (for example, public-assistance recipients or single-parent households) or against individuals who are not members of any sponsoring organization of this community.' },
      { k: 'p', text: 'This property follows HUD’s Equal Access Rule (24 CFR 5.105(a)(2); see Notice H 2015-06 of July 13, 2015). Eligibility for HUD-assisted or FHA-insured housing is determined in accordance with the program’s requirements and made available without regard to actual or perceived sexual orientation, gender identity, or marital status. No owner, administrator, approved FHA lender, or recipient or subrecipient of HUD funds may inquire about the sexual orientation or gender identity of an applicant for, or occupant of, such housing for the purpose of determining eligibility or otherwise making the housing available. This does not prohibit an individual from voluntarily self-identifying, nor does it prohibit lawful inquiries about an applicant/occupant’s sex for the purpose of determining the number of bedrooms to which a household may be entitled.' },
      { k: 'p', text: 'The above applies to:' },
      { k: 'ul', items: [
        'accepting and processing applications;',
        'selecting residents from among eligible applicants on the Waiting List;',
        'assigning units;',
        'certifying and recertifying eligibility for assistance;',
        'all other aspects of continued occupancy;',
        'reasonable accommodations and modifications.',
      ] },
      { k: 'p', text: 'Reasonable accommodations and modifications. Applicants and residents with disabilities may request a reasonable accommodation (a change in a rule, policy, practice or service) or a reasonable modification at any stage — application, waiting list, screening, move-in or occupancy — orally or in writing, to any staff member. Management will discuss the request with the person, respond in writing within {{raResponseDays}} business days after receiving the information needed to decide, and offer an alternative if a request would impose an undue financial and administrative burden or fundamentally alter the program. Verification will be requested only as described above.' },
      { k: 'p', text: 'Grievance procedure. Complaints of disability discrimination may be submitted to management and will be handled under the Section 504 grievance procedure (24 CFR 8.53).' },
      { k: 'p', text: 'Effective communication. Management will provide auxiliary aids and services (for example, sign-language interpreters, large print or other accessible formats, and relay calls through 711) free of charge when needed to communicate effectively with persons who have hearing, vision or speech disabilities (24 CFR 8.6).' },
      { k: 'p', text: 'Language assistance. Management will take reasonable steps to help applicants and residents who are not proficient in English understand the application process and this plan, such as oral interpretation or translated notices where available.' },
      { k: 'p', text: 'To file a complaint alleging a Fair Housing violation or suspected discrimination, contact HUD’s Office of Fair Housing and Equal Opportunity (FHEO) at 1-800-669-9777 (TTY 711); www.hud.gov/fairhousing/fileacomplaint.' },
      // Comment #171: the NJ complaint line is included only for NJ properties.
      { k: 'p', text: 'For this New Jersey property, complaints may also be filed with the New Jersey Division on Civil Rights at 1-833-NJDCR4U (1-833-653-2748); www.njcivilrights.gov.', when: { state: ['nj'] } },
    ],
  },
]

// ---------------------------------------------------------------------------
// Per-property choice catalogs (single-select `choice` blocks).
// `text` may contain {{merge}} tokens and "\n\n" paragraph breaks.
// ---------------------------------------------------------------------------
export interface ChoiceOption { id: string; label: string; text: string }

export const TSP_CHOICES: Record<TspChoiceKey, ChoiceOption[]> = {
  // Comment #39 — income limit, stated naturally from the HAP contract date.
  incomeLimit: [
    { id: 'very_low', label: '50% AMI — HAP effective on/after 10/1/1981',
      text: 'Because the initial HAP contract for this property was effective on or after October 1, 1981, only households whose annual income is at or below 50% of the area median income (AMI) for the county in which the property is located, adjusted for family size (the very low-income limit), may be admitted. (The extremely low-income targeting requirement in Section II.B still applies.)' },
    { id: 'low_income', label: '80% AMI — HAP effective before 10/1/1981',
      text: 'Because the initial HAP contract for this property was effective before October 1, 1981, households whose annual income is at or below 80% of the area median income (AMI) for the county in which the property is located, adjusted for family size (the low-income limit), may be admitted. (The very low-income and extremely low-income targeting requirements still apply.)' },
  ],
  // Comment #46 — three HUD income-targeting methods plus a free-text "other".
  incomeTargetingMethod: [
    { id: 'method1', label: 'Admit ELI first until 40% met',
      text: 'Admit only extremely low-income families until the 40% target is met. In chronological order, management will select eligible applicants from the waiting list whose incomes are at or below the extremely low-income limit to fill the first 40% of expected vacancies. Once the target is reached, management will admit applicants in waiting-list order (4350.3 4-5 B.2.b.(1)).' },
    { id: 'method2', label: 'Alternate ELI / top of list',
      text: 'Alternate between the first extremely low-income applicant on the waiting list and the applicant at the top of the list. Management will select the first extremely low-income applicant (which may mean skipping over some higher-income applicants) for the available unit, then select the next eligible applicant at the top of the list (regardless of income) for the next unit, continuing to alternate until the 40% target is reached (4350.3 4-5 B.2.b.(2)).' },
    { id: 'method3', label: 'Alternate in groups of ten',
      text: 'Alternate in groups of ten. In chronological order, management will admit the first 4 extremely low-income families from the waiting list and then the next 6 families from the top of the list, regardless of income — resulting in 40% or more of admissions being extremely low-income. After each group of ten, the pattern repeats (4350.3 4-5 B.2.b.(3)).' },
    { id: 'other', label: 'Other (describe)',
      text: '{{incomeTargetingOther}}' },
  ],
  // Comment #30 — for a household member who turns 18 DURING the year, the
  // property chooses whether they sign the HUD-9887 right away or at the next AR.
  consent9887Timing: [
    { id: 'now', label: 'Sign promptly when the member turns 18',
      text: 'When a household member turns 18 between annual recertifications, management will obtain their signed HUD-9887 and HUD-9887-A within the timeframe above and process an interim certification so that the member’s income-report data can be used right away.' },
    { id: 'next_ar', label: 'Sign by the next annual recertification',
      text: 'When a household member turns 18 between annual recertifications, management may wait to obtain their signed HUD-9887 and HUD-9887-A until the household’s next annual recertification. Management will not be able to run EIV for, or use income-report data for, that member until the forms are signed.' },
  ],
  // Comment #158 — how non-mandated / in-house transfers are handled and ranked.
  inHouseTransferPolicy: [
    { id: 'not_allowed', label: 'Not allowed (except hardship/RA/VAWA)',
      text: 'In-house transfers for reasons other than those above will not be allowed unless there are extenuating circumstances. VAWA emergency transfers and reasonable-accommodation transfers are always considered.' },
    { id: 'transfer_list', label: 'Allowed via a Transfer Waiting List',
      text: 'This property allows in-house transfers and maintains a separate Transfer Waiting List. Non-mandated in-house transfer requests are placed on the Transfer Waiting List. Management-mandated transfers (over/under-housing and accessible-unit moves), VAWA emergency transfers, and reasonable-accommodation transfers are considered first; remaining non-mandated transfers are then handled under the procedure below.' },
  ],
  // Procedure for sharing vacancies between the Transfer Waiting List and new
  // applicants (only shown when non-mandated transfers are allowed).
  transferAlternation: [
    { id: 'alternate', label: 'Alternate: one transfer, one new applicant',
      text: 'As units become available (after any mandated, VAWA emergency, and reasonable-accommodation transfers), management will alternate between selecting a household from the Transfer Waiting List and the next eligible applicant from the main waiting list — one transfer, then one new applicant, and so on — while remaining in compliance with the income-targeting requirements in Section II.B.' },
    { id: 'ratio', label: 'Ratio: one transfer every N units',
      text: 'As units become available (after any mandated, VAWA emergency, and reasonable-accommodation transfers), management will fill one unit from the Transfer Waiting List for every {{transferEvery}} units that become available, filling the remaining units from the main waiting list, while remaining in compliance with the income-targeting requirements in Section II.B.' },
    { id: 'other', label: 'Other (describe)',
      text: '{{transferOther}}' },
  ],
}

// Default merge-token values so a draft renders cleanly before a property fills
// in specifics. Overridden by settings.merge.
export const TSP_DEFAULT_MERGE: Record<string, string> = {
  propertyName: '[Property Name]',
  occupancyBasis: '[HAP contract / Regulatory Agreement / HUD-approved designation]',
  otherPreferences: 'This property has no other preferences.',
  smallerUnitHoldYears: '3',
  transferEvery: '3',
  transferOther: '[Describe the property’s transfer/new-applicant selection procedure.]',
  incomeTargetingOther: '[Describe the property’s alternative income-targeting method.]',
  lookbackViolentFelony: '7',
  lookbackFelonyDrug: '5',
  lookbackOtherFelony: '5',
  lookbackMisdViolent: '3',
  lookbackOtherMisd: '2',
  creditLookbackYears: '5',
  creditUnpaidThreshold: '$[____]',
  raResponseDays: '10',
  accessibleMobilityCount: '[__]',
  accessibleHearingVisionCount: '[__]',
}

export const TSP_DEFAULT_UNIT_SIZE: UnitSizeRow[] = [
  { unit: '1 Bedroom', min: '1', max: '2' },
  { unit: '2 Bedroom', min: '2', max: '4' },
  { unit: '3 Bedroom', min: '3', max: '6' },
]

// ---------------------------------------------------------------------------
// Composition: resolve the template against settings into a flat, renderable
// structure (used by the Word/PDF generators in the property documents tab).
// Footnote/endnote attachment is a separate pass (lib/tspFootnotes).
// ---------------------------------------------------------------------------
export type ResolvedListItem = { text: string; sub?: ResolvedListItem[] }
export type ResolvedBlock =
  | { k: 'p'; text: string }
  | { k: 'h'; text: string }
  | { k: 'ul'; items: ResolvedListItem[] }
  | { k: 'table'; id: string; rows: UnitSizeRow[] }
export interface ResolvedSection { num: string; title: string; blocks: ResolvedBlock[] }

function tspWhen(when: When | undefined, s: TspSettings): boolean {
  if (!when) return true
  if (when.demo && (!s.demo || !when.demo.includes(s.demo))) return false
  if (when.state && (!s.state || !when.state.includes(s.state))) return false
  if (when.program && (!s.program || !when.program.includes(s.program))) return false
  if (when.flag && !s.flags?.[when.flag as TspFlag]) return false
  if (when.notFlag && s.flags?.[when.notFlag as TspFlag]) return false
  if (when.choiceEq && s.choices?.[when.choiceEq.setting as TspChoiceKey] !== when.choiceEq.value) return false
  return true
}

function tspMerge(text: string, s: TspSettings): string {
  const map: Record<string, string> = { ...TSP_DEFAULT_MERGE, ...(s.merge || {}) }
  return text.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => (map[k] != null ? map[k] : `{{${k}}}`))
}

function tspListItem(item: ListItem, s: TspSettings): ResolvedListItem | null {
  if (typeof item === 'string') return { text: tspMerge(item, s) }
  if (!tspWhen(item.when, s)) return null
  const sub = item.sub?.map(i => tspListItem(i, s)).filter(Boolean) as ResolvedListItem[] | undefined
  return { text: tspMerge(item.text, s), ...(sub && sub.length ? { sub } : {}) }
}

// Split choice/upload text into paragraphs on blank lines.
function tspParas(text: string, s: TspSettings): ResolvedBlock[] {
  return tspMerge(text, s).split(/\n\s*\n/).map(t => t.trim()).filter(Boolean).map(t => ({ k: 'p' as const, text: t }))
}

function tspBlock(b: Block, s: TspSettings): ResolvedBlock[] {
  if (!tspWhen(b.when, s)) return []
  switch (b.k) {
    case 'p': return [{ k: 'p', text: tspMerge(b.text, s) }]
    case 'h': return [{ k: 'h', text: tspMerge(b.text, s) }]
    case 'ul': {
      const items = b.items.map(i => tspListItem(i, s)).filter(Boolean) as ResolvedListItem[]
      return items.length ? [{ k: 'ul', items }] : []
    }
    case 'choice': {
      const opts = TSP_CHOICES[b.setting as TspChoiceKey] || []
      const sel = s.choices?.[b.setting as TspChoiceKey]
      const opt = opts.find(o => o.id === sel) || opts[0]
      return opt ? tspParas(opt.text, s) : []
    }
    case 'upload': {
      const pasted = s.uploads?.[b.setting as TspUploadKey]
      if (pasted && pasted.trim()) return tspParas(pasted, s)
      return b.fallback.flatMap(fb => tspBlock(fb, s))
    }
    case 'table': {
      const rows = (b.id === 'unitSize' ? (s.unitSizeRows && s.unitSizeRows.length ? s.unitSizeRows : TSP_DEFAULT_UNIT_SIZE) : [])
      return [{ k: 'table', id: b.id, rows }]
    }
  }
}

export function composeTsp(settings: TspSettings): ResolvedSection[] {
  return TSP_SECTIONS
    .filter(sec => tspWhen(sec.when, settings))
    .map(sec => {
      const ov = settings.overrides?.[sec.id]
      // An override replaces the section body with the user's own wording.
      const blocks: ResolvedBlock[] = (ov && ov.trim())
        ? tspParas(ov, settings)
        : sec.blocks.flatMap(b => tspBlock(b, settings))
      // Property-specific items are appended to the end of their section.
      for (const c of settings.customItems || []) {
        if (c.sectionId === sec.id && c.text.trim()) blocks.push(...tspParas(c.text, settings))
      }
      return { num: sec.num, title: sec.title, blocks }
    })
}

// Section list (id/num/title) for building settings UIs.
export const TSP_SECTION_LIST = TSP_SECTIONS.map(s => ({ id: s.id, num: s.num, title: s.title }))

// Render a section's default wording (no citations) as editable plain text,
// for prefilling the "edit section wording" box.
export function tspSectionText(sectionId: string, settings: TspSettings): string {
  const sec = TSP_SECTIONS.find(s => s.id === sectionId)
  if (!sec) return ''
  const lines: string[] = []
  const walk = (items: ResolvedListItem[], depth = 0) => {
    for (const it of items) { lines.push(`${'   '.repeat(depth)}- ${it.text}`); if (it.sub) walk(it.sub, depth + 1) }
  }
  for (const b of sec.blocks.flatMap(bl => tspBlock(bl, settings))) {
    if (b.k === 'h' || b.k === 'p') lines.push(b.text)
    else if (b.k === 'ul') walk(b.items)
    else if (b.k === 'table') lines.push('[Unit-size table]')
  }
  return lines.join('\n\n')
}
