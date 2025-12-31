import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// ============================================
// Enums
// ============================================

export type BillingCycle = 'monthly' | 'yearly';

export enum PaymentStatus {
  IDLE = 'IDLE',
  CREATING_ORDER = 'CREATING_ORDER',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  VERIFYING = 'VERIFYING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum SubscriptionErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  ORDER_CREATION_FAILED = 'ORDER_CREATION_FAILED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_CANCELLED = 'PAYMENT_CANCELLED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  FREE_PLAN_FAILED = 'FREE_PLAN_FAILED',
  UNKNOWN = 'UNKNOWN',
}

// ============================================
// Service/Plan Types
// ============================================

export interface IService {
  id: string;
  title: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyLabel: string;
}

// ============================================
// API Types
// ============================================

export interface IPaymentOrderResponse {
  data: {
    order_id: string;
    amount: number;
    currency: string;
    plan: string;
  };
}

export interface IRazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface IRazorpayErrorResponse {
  code: string;
  description: string;
}

export interface IRazorpayOptions {
  description: string;
  image: number; // require() returns number in RN
  currency: string;
  key: string;
  amount: number;
  order_id: string;
  name: string;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
  theme: { color: string };
}

// ============================================
// State Types
// ============================================

export interface SubscriptionError {
  type: SubscriptionErrorType;
  message: string;
  retryable: boolean;
  razorpayCode?: string;
}

export interface SubscriptionState {
  selectedPlan: IService | null;
  billingCycle: BillingCycle;
  paymentStatus: PaymentStatus;
  error: SubscriptionError | null;
  isFirstTimeUser: boolean;
  isInitializing: boolean;
}

export type SubscriptionAction =
  | { type: 'SET_PLAN'; payload: IService }
  | { type: 'SET_BILLING_CYCLE'; payload: BillingCycle }
  | { type: 'SET_PAYMENT_STATUS'; payload: PaymentStatus }
  | { type: 'SET_ERROR'; payload: SubscriptionError | null }
  | { type: 'SET_FIRST_TIME_USER'; payload: boolean }
  | { type: 'SET_INITIALIZING'; payload: boolean }
  | { type: 'RESET_ERROR' }
  | { type: 'RESET' };

// ============================================
// Navigation Types
// ============================================

export type SubscriptionStackParamList = {
  Services: undefined;
  SubscriptionDetails: {
    plan?: IService;
    billingCycle?: BillingCycle;
  };
};

export type ServicesScreenNavigationProp = NativeStackNavigationProp<
  SubscriptionStackParamList,
  'Services'
>;

export type SubscriptionDetailsRouteProp = RouteProp<
  SubscriptionStackParamList,
  'SubscriptionDetails'
>;

export type SubscriptionDetailsNavigationProp = NativeStackNavigationProp<
  SubscriptionStackParamList,
  'SubscriptionDetails'
>;

// ============================================
// Component Props
// ============================================

export interface BillingToggleProps {
  billingCycle: BillingCycle;
  onCycleChange: (cycle: BillingCycle) => void;
  disabled?: boolean;
}

export interface PlanCardProps {
  plan: IService;
  billingCycle: BillingCycle;
  isSelected: boolean;
  onSelect: (plan: IService) => void;
  disabled?: boolean;
}

export interface PlanSelectorProps {
  plans: IService[];
  selectedPlan: IService | null;
  billingCycle: BillingCycle;
  onPlanSelect: (plan: IService) => void;
  disabled?: boolean;
}

export interface FeaturesTableProps {
  plans: IService[];
  featureRows: string[];
  featuresMatrix: Record<string, boolean[]>;
}

export interface SubscribeButtonProps {
  price: number;
  isLoading: boolean;
  disabled: boolean;
  onPress: () => void;
}

export interface SubscriptionDetailsViewProps {
  plans: IService[];
  selectedPlan: IService | null;
  billingCycle: BillingCycle;
  paymentStatus: PaymentStatus;
  error: SubscriptionError | null;
  featureRows: string[];
  featuresMatrix: Record<string, boolean[]>;
  onPlanSelect: (plan: IService) => void;
  onBillingCycleChange: (cycle: BillingCycle) => void;
  onSubscribe: () => void;
  onRetry: () => void;
  onDismissError: () => void;
}

// ============================================
// Hook Return Types
// ============================================

export interface UseSubscriptionReturn {
  state: SubscriptionState;
  selectPlan: (plan: IService) => void;
  setBillingCycle: (cycle: BillingCycle) => void;
  resetError: () => void;
  reset: () => void;
  finalPrice: number;
}

export interface UsePaymentReturn {
  processPayment: () => Promise<boolean>;
  processFreePlan: () => Promise<boolean>;
  isProcessing: boolean;
}

export interface UseFirstTimeCheckReturn {
  isFirstTime: boolean;
  isLoading: boolean;
  markAsReturningUser: () => Promise<void>;
}