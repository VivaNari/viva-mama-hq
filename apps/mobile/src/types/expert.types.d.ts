export interface IExpert {
  id: number;
  name: string;
  remuneration: string;
  avatar: number;
  description: string;
  whatsappNumber: string;
}

export interface IExpertCategory {
  id: number;
  category: string;
  experts: Expert[];
}
