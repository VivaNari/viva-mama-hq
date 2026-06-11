export interface IInfantData {
  age: string;
  scoreImage: number;
  description: string;
  checkinOptions: IInfantCheckinOptions[];
}

export interface IInfantCheckinOptions {
  title: string;
  screen: string;
}
