import { IPartnerData } from "../types/addPartner.types";

// NOTE: text fields below hold i18n keys (resolved with t() at render). `code` is literal.
export const partnerData: IPartnerData = {
  title: "addPartner.title",
  benefits: [
    { id: 1, text: "addPartner.benefit1" },
    { id: 2, text: "addPartner.benefit2" },
    { id: 3, text: "addPartner.benefit3" },
  ],
  code: "738H645",
  steps: [
    {
      id: 1,
      title: "addPartner.step1Title",
      description: "addPartner.step1Desc",
    },
    {
      id: 2,
      title: "addPartner.step2Title",
      description: "addPartner.step2Desc",
    },
  ],
};
