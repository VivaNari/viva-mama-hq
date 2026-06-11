export type VaccineStatus = 'Yes' | 'No';

export type Vaccine = {
  name: string;
  description?: string;
  status: VaccineStatus;
};
export type VaccinationData = Record<string, Vaccine[]>;

export type Tab = 'Birth' | '6 Weeks' | '10 Weeks';

export type ToggleSwitchProps = {
  vaccineName: string;
  status: VaccineStatus;
  onToggle: (vaccineName: string, newStatus: VaccineStatus) => void;
};

export type VaccineCardProps = {
  vaccines: Vaccine[];
  onToggle: (vaccineName: string, newStatus: VaccineStatus) => void;
};
