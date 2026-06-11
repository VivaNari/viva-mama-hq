export interface IUserProfile {
  name: string;
  age: number;
  height: string;
  email: string;
}

export interface IFormField {
  key: keyof IUserProfile;
  label: string;
  placeholder?: string;
  type: 'text' | 'number' | 'email';
}
