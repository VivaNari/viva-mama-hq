export interface IService {
  id: string;
  title: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyLabel: string;
}

export interface IRazorpayOptions {
  key: string;
  amount: string;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
}

export interface IPaymentOrderResponse {
  data: IPaymentOrderResponseData;
  statusCode: number;
  message: string;
  success: boolean;
}
export interface IPaymentOrderResponseData {
  order_id: string;
  receipt: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
