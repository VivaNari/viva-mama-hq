import { IPartnerData } from "../types/addPartner.types";

export const partnerData: IPartnerData = {
  title: "Vivanari for partners",
  benefits: [
    { id: 1, text: "Expand your reach and connect with more clients" },
    { id: 2, text: "Access professional tools to manage your partnerships" },
    {
      id: 3,
      text: "Earn competitive commissions on every successful referral",
    },
  ],
  code: "738H645",
  steps: [
    {
      id: 1,
      title: "Step 1 - Invite",
      description:
        "Share your unique partner code with your network via email, social media, or direct messaging.",
    },
    {
      id: 2,
      title: "Step 2 - Pair",
      description:
        "When your referrals sign up using your code, they are automatically linked to your partner account.",
    },
  ],
};
