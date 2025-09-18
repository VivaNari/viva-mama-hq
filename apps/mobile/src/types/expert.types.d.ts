export interface IExpert {
  id: number;
  name: string;
  remuneration: string;
  avatar: number;
  description: string;
}

export interface IExpertCategory {
  id: number;
  category: string;
  experts: Expert[];
}
