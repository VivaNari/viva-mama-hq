import { useCallback, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { RAZORPAY_API_KEY } from "@env";
import RazorpayCheckout from "react-native-razorpay";
import Toast from "react-native-toast-message";

import apiClientInterceptor from "../api/apiClientInterceptor";
import {
  RAZORPAY_CREATE_ORDER,
  RAZORPAY_VERIFY_ORDER,
  SUBSCRIBE_FREE_PLAN,
} from "../constants/endpoints";
import { colors } from "../public/assets/colors";

import {
  IService,
  BillingCycle,
  PaymentStatus,
  IRazorpayOptions,
  IRazorpaySuccessResponse,
  IRazorpayErrorResponse,
  IPaymentOrderResponse,
  SubscriptionAction,
} from "../types/subscription.types";
import { RAZORPAY_CONFIG, TOAST_MESSAGES } from "../constants/subscription";
import {
  parseRazorpayError,
  createOrderCreationError,
  createVerificationError,
  createFreePlanError,
  validateRazorpayResponse,
} from "../utils/paymentHelpers";
import { subscriptionLogger } from "../utils/logger";

interface UsePaymentProps {
  selectedPlan: IService | null;
  billingCycle: BillingCycle;
  finalPrice: number;
  dispatch: React.Dispatch<SubscriptionAction>;
  onSuccess: () => Promise<void>;
}

interface UsePaymentReturn {
  processPayment: () => Promise<boolean>;
  processFreePlan: () => Promise<boolean>;
  isProcessing: boolean;
}

export const usePayment = ({
  selectedPlan,
  billingCycle,
  finalPrice,
  dispatch,
  onSuccess,
}: UsePaymentProps): UsePaymentReturn => {
  const [isProcessing, setIsProcessing] = useState(false);
  const backHandlerRef = useRef<ReturnType<
    typeof BackHandler.addEventListener
  > | null>(null);

  /**
   * Disable back button during payment
   */
  const disableBackButton = useCallback(() => {
    backHandlerRef.current = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        Toast.show({
          type: "info",
          text1: "Payment in progress",
          text2: "Please complete or cancel the payment",
          position: "bottom",
        });
        return true;
      },
    );
  }, []);

  /**
   * Re-enable back button
   */
  const enableBackButton = useCallback(() => {
    if (backHandlerRef.current) {
      backHandlerRef.current.remove();
      backHandlerRef.current = null;
    }
  }, []);

  /**
   * Process free plan subscription
   */
  const processFreePlan = useCallback(async (): Promise<boolean> => {
    if (!selectedPlan) {
      subscriptionLogger.error("No plan selected for free subscription");
      return false;
    }

    if (isProcessing) {
      subscriptionLogger.warn("Payment already in progress");
      return false;
    }

    setIsProcessing(true);
    dispatch({
      type: "SET_PAYMENT_STATUS",
      payload: PaymentStatus.CREATING_ORDER,
    });

    try {
      await apiClientInterceptor().post(SUBSCRIBE_FREE_PLAN, {
        plan: selectedPlan.title,
        billingCycle: billingCycle,
      });

      dispatch({ type: "SET_PAYMENT_STATUS", payload: PaymentStatus.SUCCESS });

      Toast.show({
        type: "success",
        text1: TOAST_MESSAGES.FREE_PLAN_SUCCESS.title,
        text2: TOAST_MESSAGES.FREE_PLAN_SUCCESS.message,
        position: "bottom",
      });

      await onSuccess();
      return true;
    } catch (error) {
      console.log("error", error);
      subscriptionLogger.error("Free plan subscription failed", error);
      dispatch({ type: "SET_ERROR", payload: createFreePlanError(error) });
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPlan, billingCycle, isProcessing, dispatch, onSuccess]);

  /**
   * Create Razorpay order
   */
  const createOrder = useCallback(async (): Promise<
    IPaymentOrderResponse["data"] | null
  > => {
    if (!selectedPlan) return null;

    try {
      const { data } = (await apiClientInterceptor().post(
        RAZORPAY_CREATE_ORDER,
        {
          amount: finalPrice,
          plan: selectedPlan.title,
          billingCycle: billingCycle,
        },
      )) as { data: IPaymentOrderResponse };

      return data.data;
    } catch (error) {
      subscriptionLogger.error("Order creation failed", error);
      throw error;
    }
  }, [selectedPlan, billingCycle, finalPrice]);

  const verifyPayment = useCallback(
    async (paymentResponse: IRazorpaySuccessResponse): Promise<void> => {
      dispatch({
        type: "SET_PAYMENT_STATUS",
        payload: PaymentStatus.VERIFYING,
      });

      try {
        await apiClientInterceptor().post(RAZORPAY_VERIFY_ORDER, {
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_signature: paymentResponse.razorpay_signature,
        });
      } catch (error) {
        subscriptionLogger.error("Payment verification failed", error);
        throw error;
      }
    },
    [dispatch],
  );

  /**
   * Process paid subscription via Razorpay
   */
  const processPayment = useCallback(async (): Promise<boolean> => {
    if (!selectedPlan) {
      subscriptionLogger.error("No plan selected for payment");
      return false;
    }

    if (isProcessing) {
      subscriptionLogger.warn("Payment already in progress");
      return false;
    }

    setIsProcessing(true);
    disableBackButton();
    dispatch({
      type: "SET_PAYMENT_STATUS",
      payload: PaymentStatus.CREATING_ORDER,
    });

    try {
      // Step 1: Create order
      const orderData = await createOrder();
      if (!orderData) {
        throw new Error("Failed to create order");
      }

      // Step 2: Open Razorpay checkout
      dispatch({
        type: "SET_PAYMENT_STATUS",
        payload: PaymentStatus.AWAITING_PAYMENT,
      });

      const options: IRazorpayOptions = {
        description: `${RAZORPAY_CONFIG.DESCRIPTION_PREFIX} ${orderData.plan}`,
        image: require("../public/assets/images/viva_logo.png"),
        currency: orderData.currency,
        key: RAZORPAY_API_KEY,
        amount: orderData.amount,
        order_id: orderData.order_id,
        name: RAZORPAY_CONFIG.APP_NAME,
        theme: { color: colors.darkPurple },
      };

      const paymentResponse = await RazorpayCheckout.open(options as any);

      // Validate response
      if (!validateRazorpayResponse(paymentResponse)) {
        throw new Error("Invalid payment response");
      }

      // Step 3: Verify payment
      await verifyPayment(paymentResponse);

      // Step 4: Success
      dispatch({ type: "SET_PAYMENT_STATUS", payload: PaymentStatus.SUCCESS });

      Toast.show({
        type: "success",
        text1: TOAST_MESSAGES.PAYMENT_SUCCESS.title,
        text2: TOAST_MESSAGES.PAYMENT_SUCCESS.message,
        position: "bottom",
      });

      await onSuccess();
      return true;
    } catch (error) {
      subscriptionLogger.error("Payment process failed", error);

      // Handle Razorpay specific errors
      if (error && typeof error === "object" && "code" in error) {
        const razorpayError = error as IRazorpayErrorResponse;
        dispatch({
          type: "SET_ERROR",
          payload: parseRazorpayError(razorpayError),
        });
      } else if (
        error instanceof Error &&
        error.message.includes("verification")
      ) {
        dispatch({
          type: "SET_ERROR",
          payload: createVerificationError(error),
        });

        Toast.show({
          type: "error",
          text1: TOAST_MESSAGES.VERIFICATION_FAILED.title,
          text2: TOAST_MESSAGES.VERIFICATION_FAILED.message,
          position: "bottom",
        });
      } else {
        dispatch({
          type: "SET_ERROR",
          payload: createOrderCreationError(error),
        });
      }

      return false;
    } finally {
      setIsProcessing(false);
      enableBackButton();
    }
  }, [
    selectedPlan,
    isProcessing,
    disableBackButton,
    enableBackButton,
    dispatch,
    createOrder,
    verifyPayment,
    onSuccess,
  ]);

  return {
    processPayment,
    processFreePlan,
    isProcessing,
  };
};
