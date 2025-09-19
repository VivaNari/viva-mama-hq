export interface INotification {
  id: string | number;
  title: string;
  message: string;
  targetScreen?: string;
  params?: Record<string, any>;
}
