export interface IExpert {
  _id: string;
  name: string;
  speciality: string;
  qualification: string;
  yearsOfExperience: number;
  bio: string;
  photograph: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

export interface IExpertResponse {
  statusCode: number;
  success: boolean;
  data: IExpert[];
  message: string;
}
export interface IExpertByIdResponse {
  statusCode: number;
  success: boolean;
  data: IExpert;
  message: string;
}

export interface IExpertCategory {
  id: number;
  category: string;
  experts: Expert[];
}
