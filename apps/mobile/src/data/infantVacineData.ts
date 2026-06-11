import { VaccinationData } from '../types/infantVaccine.types';

export const VACCINATION_DATA: VaccinationData = {
  Birth: [
    { name: 'BCG', description: '(Bacillus Calmette-Guérin)', status: 'No' },
    { name: 'Hepatitis B1', status: 'No' },
    { name: 'OPV', description: '(oral polio vaccine)', status: 'No' },
  ],
  '6 Weeks': [
    { name: 'DTwP/DTaP1', status: 'No' },
    { name: 'Hib-1', status: 'No' },
    { name: 'IPV-1', status: 'No' },
    { name: 'Hep B2', status: 'No' },
    { name: 'PCV 1', status: 'No' },
    { name: 'Rota-1', status: 'No' },
  ],
  '10 Weeks': [
    { name: 'DTwP/DTaP-2', description: '(Second Dose)', status: 'No' },
    { name: 'Hib-2', description: '(Second Dose)', status: 'No' },
    { name: 'IPV-2', description: '(Second Dose)', status: 'No' },
    { name: 'Rota-2', description: '(Second Dose)', status: 'No' },
    { name: 'PCV-2', description: '(Second Dose)', status: 'No' },
  ],
};
