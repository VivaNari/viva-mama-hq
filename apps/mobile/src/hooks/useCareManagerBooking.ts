import { RAZORPAY_API_KEY } from "@env";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import RazorpayCheckout from "react-native-razorpay";
import Toast from "react-native-toast-message";
import apiClientInterceptor from "../api/apiClientInterceptor";
import { requestCallback } from "../api/requestCallback";
import {
  RAZORPAY_BOOK_CONSULTATION_CREATE_ORDER,
  RAZORPAY_BOOK_CONSULTATION_VERIFY_ORDER,
} from "../constants/endpoints";
import { PreferredSlot } from "../constants/consultationSlots";
import { useAuth } from "../context/AuthContext";
import { useSubscriptionContext } from "../context/SubscriptionContext";
import { chatDB } from "../db/sqlite";
import { colors } from "../public/assets/colors";
import { ConsultationTypeEnum } from "../types/consultation.types";
import { IRequestCallbackResponse } from "../types/careManager.types";
import { IPaymentOrderResponse } from "../types/subscription.types";
import { AnalyticsEvent, recordError, track } from "../analytics";

/**
 * Booking a postpartum counsellor, credit-first with a payment fallback.
 *
 * Counsellor calls used to be premium-only — a user without a credit was refused
 * outright. They now work exactly like expert consultations: spend a credit if there is
 * one, otherwise pay the fee on the counsellor's document.
 *
 * Lives in a hook because both entry points (the dashboard card and the chat prompt)
 * need the identical branch, and the two components had already drifted once while
 * holding copy-pasted booking logic.
 */
export const useCareManagerBooking = (onBooked: () => void) => {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const { entitlements, refresh } = useSubscriptionContext();

  const [careManagerId, setCareManagerId] = useState<string>();
  const [fee, setFee] = useState<number>();
  const [loading, setLoading] = useState(false);

  const credits = entitlements?.credits?.careManager ?? 0;
  const hasCredit = credits > 0;

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const cached = await chatDB.getUserData(userId as string);
        if (cached?.data?.caremanager) {
          setCareManagerId(cached.data.caremanager.id);
          setFee(cached.data.caremanager.remuneration);
        }
      } catch (error) {
        console.error("Error loading postpartum counsellor data:", error);
        recordError(error, "useCareManagerBooking.loadCounsellor");
      }
    })();
  }, [userId]);

  const showError = useCallback(() => {
    Toast.show({
      type: "error",
      text1: t("common.error"),
      text2: t("common.somethingWrong"),
      position: "bottom",
    });
  }, [t]);

  /** Credit route: no gateway, the entitlement layer decides whether it is allowed. */
  const bookWithCredit = useCallback(
    async (date: Date, slot: PreferredSlot) => {
      const response = (await requestCallback(
        careManagerId as string,
        date.toISOString(),
        slot,
      )) as IRequestCallbackResponse;

      if (!response.success) {
        showError();
        track(AnalyticsEvent.CONSULTATION_BOOKING_FAILED, {
          consultation_type: "care_manager",
          reason: "credit_request_rejected",
        });
        return;
      }

      await refresh();
      track(AnalyticsEvent.CONSULTATION_BOOKED, {
        consultation_type: "care_manager",
        payment_mode: "credit",
      });
      onBooked();
    },
    [careManagerId, onBooked, refresh, showError],
  );

  /**
   * Payment route, mirroring the expert flow: create an order, open the sheet, then
   * verify. The consultation is only created server-side on a verified payment, so an
   * abandoned sheet leaves nothing behind.
   */
  const bookWithPayment = useCallback(
    async (date: Date, slot: PreferredSlot) => {
      const { data } = (await apiClientInterceptor().post(
        RAZORPAY_BOOK_CONSULTATION_CREATE_ORDER,
        {
          amount: fee,
          consultantId: careManagerId,
          consultationType: ConsultationTypeEnum.CARE_MANAGER,
          date: date.toISOString(),
          preferredSlot: slot,
        },
      )) as { data: IPaymentOrderResponse };

      const options: any = {
        description: t("careManager.requestCallTitle"),
        image: require("../public/assets/images/viva_logo.png"),
        currency: data.data.currency,
        key: RAZORPAY_API_KEY,
        amount: data.data.amount,
        order_id: data.data.order_id,
        name: t("careManager.requestCallTitle"),
        prefill: {},
        theme: { color: colors.darkPurple },
      };

      const razorpayData = await RazorpayCheckout.open(options);

      await apiClientInterceptor().post(
        RAZORPAY_BOOK_CONSULTATION_VERIFY_ORDER,
        {
          razorpay_order_id: razorpayData.razorpay_order_id,
          razorpay_payment_id: razorpayData.razorpay_payment_id,
          razorpay_signature: razorpayData.razorpay_signature,
        },
      );

      await refresh();
      // Only after verification. A resolved Razorpay sheet is not a booking —
      // the consultation is created server-side on the verified payment.
      track(AnalyticsEvent.CONSULTATION_BOOKED, {
        consultation_type: "care_manager",
        payment_mode: "payment",
      });
      onBooked();
    },
    [careManagerId, fee, onBooked, refresh, t],
  );

  const book = useCallback(
    async (date: Date, slot: PreferredSlot) => {
      if (!careManagerId) return;

      const paymentMode = hasCredit ? "credit" : "payment";
      track(AnalyticsEvent.CONSULTATION_BOOKING_STARTED, {
        consultation_type: "care_manager",
        payment_mode: paymentMode,
      });

      try {
        setLoading(true);
        if (hasCredit) {
          await bookWithCredit(date, slot);
        } else {
          await bookWithPayment(date, slot);
        }
      } catch (error) {
        // A 402 has already opened the paywall centrally. A dismissed Razorpay
        // sheet reports itself as an error too, and is not worth a toast — the
        // user closed it on purpose.
        const status = (error as any)?.response?.status;
        const userCancelled =
          (error as any)?.code === 0 || (error as any)?.code === 2;
        if (status !== 402 && !userCancelled) {
          showError();
          // Neither a paywall refusal nor a deliberate dismissal is a fault, so
          // only what is left gets recorded as one.
          recordError(error, "useCareManagerBooking.book", {
            payment_mode: paymentMode,
          });
        }

        track(AnalyticsEvent.CONSULTATION_BOOKING_FAILED, {
          consultation_type: "care_manager",
          reason: userCancelled
            ? "razorpay_cancelled"
            : String(status ?? "unknown"),
        });
      } finally {
        setLoading(false);
      }
    },
    [bookWithCredit, bookWithPayment, careManagerId, hasCredit, showError],
  );

  return { careManagerId, credits, hasCredit, fee, loading, book };
};
