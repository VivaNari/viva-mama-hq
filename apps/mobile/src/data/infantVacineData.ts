import { IVaccinationVisit, TVaccinationSector } from '../types/infantLog.types';

/**
 * Immunisation schedules, split by the sector the mother chose during baby onboarding
 * (PRD 4.4) and stored on the child as `vaccination_sector`.
 *
 * Public is the Government's National Immunization Schedule, given free at a UWIN centre
 * or government hospital. Private is the paediatrician-administered IAP schedule, which
 * covers the same diseases on a denser calendar with combination vaccines.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * CLINICAL REVIEW REQUIRED before this ships. These lists are transcribed from the public
 * NIS and IAP schedules to give the screen something real to render; they are not a
 * clinician's copy. Reconcile against the NIS PDF and the team's vaccination sheet (both
 * linked in the PRD) and have Dr Harsha sign off, because a missing or misdated row here
 * reads to a mother as "not due".
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Vaccine names are deliberately untranslated — they are proper nouns that appear on the
 * card the clinic hands over, and a Hindi rendering would stop matching it. Only the
 * explanatory lines carry i18n keys.
 */
export const VACCINATION_SCHEDULE: Record<TVaccinationSector, IVaccinationVisit[]> = {
  public: [
    {
      key: 'birth',
      labelKey: 'infant.vaccination.visitBirth',
      vaccines: [
        { name: 'BCG', descriptionKey: 'infant.vaccination.bcgHint' },
        { name: 'Hepatitis B — birth dose', descriptionKey: 'infant.vaccination.hepBHint' },
        { name: 'OPV-0', descriptionKey: 'infant.vaccination.opvHint' },
      ],
    },
    {
      key: '6w',
      labelKey: 'infant.vaccination.visit6Weeks',
      vaccines: [
        { name: 'OPV-1' },
        { name: 'Pentavalent-1' },
        { name: 'Rotavirus-1' },
        { name: 'fIPV-1' },
        { name: 'PCV-1' },
      ],
    },
    {
      key: '10w',
      labelKey: 'infant.vaccination.visit10Weeks',
      vaccines: [{ name: 'OPV-2' }, { name: 'Pentavalent-2' }, { name: 'Rotavirus-2' }],
    },
    {
      key: '14w',
      labelKey: 'infant.vaccination.visit14Weeks',
      vaccines: [
        { name: 'OPV-3' },
        { name: 'Pentavalent-3' },
        { name: 'Rotavirus-3' },
        { name: 'fIPV-2' },
        { name: 'PCV-2' },
      ],
    },
    {
      key: '9m',
      labelKey: 'infant.vaccination.visit9Months',
      vaccines: [
        { name: 'MR-1' },
        { name: 'PCV booster' },
        { name: 'JE-1', descriptionKey: 'infant.vaccination.jeHint' },
      ],
    },
    {
      key: '16m',
      labelKey: 'infant.vaccination.visit16Months',
      vaccines: [
        { name: 'MR-2' },
        { name: 'DPT booster-1' },
        { name: 'OPV booster' },
        { name: 'JE-2', descriptionKey: 'infant.vaccination.jeHint' },
      ],
    },
  ],

  private: [
    {
      key: 'birth',
      labelKey: 'infant.vaccination.visitBirth',
      vaccines: [
        { name: 'BCG', descriptionKey: 'infant.vaccination.bcgHint' },
        { name: 'Hepatitis B1', descriptionKey: 'infant.vaccination.hepBHint' },
        { name: 'OPV-0', descriptionKey: 'infant.vaccination.opvHint' },
      ],
    },
    {
      key: '6w',
      labelKey: 'infant.vaccination.visit6Weeks',
      vaccines: [
        { name: 'DTwP/DTaP-1' },
        { name: 'IPV-1' },
        { name: 'Hib-1' },
        { name: 'Hepatitis B2' },
        { name: 'PCV-1' },
        { name: 'Rotavirus-1' },
      ],
    },
    {
      key: '10w',
      labelKey: 'infant.vaccination.visit10Weeks',
      vaccines: [
        { name: 'DTwP/DTaP-2' },
        { name: 'IPV-2' },
        { name: 'Hib-2' },
        { name: 'PCV-2' },
        { name: 'Rotavirus-2' },
      ],
    },
    {
      key: '14w',
      labelKey: 'infant.vaccination.visit14Weeks',
      vaccines: [
        { name: 'DTwP/DTaP-3' },
        { name: 'IPV-3' },
        { name: 'Hib-3' },
        { name: 'PCV-3' },
        { name: 'Rotavirus-3' },
      ],
    },
    {
      key: '6m',
      labelKey: 'infant.vaccination.visit6Months',
      vaccines: [{ name: 'Hepatitis B3' }, { name: 'Influenza-1' }],
    },
    {
      key: '9m',
      labelKey: 'infant.vaccination.visit9Months',
      vaccines: [{ name: 'MMR-1' }, { name: 'Influenza-2' }],
    },
    {
      key: '12m',
      labelKey: 'infant.vaccination.visit12Months',
      vaccines: [{ name: 'Hepatitis A1' }],
    },
    {
      key: '15m',
      labelKey: 'infant.vaccination.visit15Months',
      vaccines: [{ name: 'MMR-2' }, { name: 'Varicella-1' }, { name: 'PCV booster' }],
    },
    {
      key: '18m',
      labelKey: 'infant.vaccination.visit18Months',
      vaccines: [
        { name: 'DTwP/DTaP booster-1' },
        { name: 'IPV booster' },
        { name: 'Hib booster' },
        { name: 'Hepatitis A2' },
      ],
    },
  ],
};
