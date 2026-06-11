export interface IBenefit {
  id: number;
  text: string;
}

export interface IPartnerStep {
  id: number;
  title: string;
  description: string;
}

export interface IPartnerData {
  title: string;
  benefits: IBenefit[];
  code: string;
  steps: IPartnerStep[];
}
