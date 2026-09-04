# Multi-Language (i18n) Rollout Progress

Tracks the screen-by-screen migration of hardcoded UI strings to `react-i18next`.
Infrastructure (i18n setup, language popup, profile language switcher) is complete — see `src/i18n/`.

**Convention:** one top-level namespace per screen/area in `src/i18n/locales/en.json` + `hi.json`, plus shared `common`.
**Out of scope (per product decision):** anything that comes from the backend — article bodies, expert bios, onboarding questionnaire (served via the ChatWithVivaAI flow), etc. Translate **only static UI text**. Do not translate `phqData.ts` (backend-served content + only referenced by dead screens).

**Dead code (skip):** `OnboardingSteps.tsx`, `ChatWithVivaAIOld.tsx`, `test.html` — not referenced by any navigator.

Legend: ✅ done · �doing · ⬜ todo · ⏭️ skip (dead file)

---

## Phase 1 — Auth & Onboarding
- ✅ `Landing.tsx` (namespace: `landing` + shared `auth`)
- ✅ `LoginwithPhone.tsx` (namespace: shared `auth`)
- ✅ `OnboardingSteps.tsx` chrome translated (namespace: `onboarding`) — ⚠️ DEAD CODE; questionnaire (`phqData`) intentionally NOT translated (backend content). Real onboarding = `ChatWithVivaAI` (Phase 7).
- ✅ `Subscription.tsx` + both `SubscriptionDetails` impls + all `subscriptions/*` + helpers/constants/data (namespace: `subscription`). Feature rows & yearly label converted to i18n keys in `servicesData.ts`; `ERROR_MESSAGES`/`TOAST_MESSAGES` constants now hold keys resolved via `t()`/`i18n.t()`. Plan titles ("Viva Basic/Signature") kept as brand names.
- ✅ `Services copy.tsx` (the `Services` route, reachable from Dashboard) — reuses `subscription.*`; added `common.seeMore`, `products.suggested`. Fixed "Choose a plan1" typo via shared key. Pre-existing unrelated tsc error: `FLProductItem` import.

## Phase 2 — Core dashboard & tabs
- ✅ `Dashboard.tsx` (namespace: `dashboard`) + `DashboardMotherTab` + `CareManagerCard` (`careManager`) + `NNWomanPlanningForBaby` / `NPWomanBabyArriving` + `IndividualRecoveryCard` (`recovery`). `ArticleCard`/`ActiveConsultation`/`ItemProduct`/`GradientButtonWithSlightRadius`/`DashboardCard` = no static text (render backend data). ⚠️ DEAD: `DashboardInfantTab`, `FLInfantCheckInOptions`, `infantData` (not referenced) — skipped.
  - ✅ Dashboard bottom sheets (namespace: `vivaScore`): `HowToGenerateVivaScoreGuide`, `RecoveryScoreBriefInfo` (+4 disclaimers), `RecoveryProgressGraph`. `vivaScore.disclaimer*` reusable for `AboutRecoveryScore` (Phase 4).
- ✅ `Experts.tsx` (reuses `dashboard.*` disclaimers) + `VivaBuddyRequestCall` (reuses `careManager.*`, added `requestCallTitle`/`hours`/`requestShort`) + `FLExpertItem` (`experts.yearsExperience` via `i18n.t` since it's called as a fn, not JSX). `FLExpertCategoryItem` = backend data only (has pre-existing unrelated `category` prop tsc error).
- ✅ `Products.tsx` (`products.amazonDisclaimer`, `products.noProductsFound`) + `SearchInput` (`common.search`, shared component). `ItemProduct` = backend data only (no static text).
- ✅ `ArticleContent.tsx` (the Services-tab content; namespace: `content`) — disclaimers, "Community Feed", empty/CTA states, search. `FLVivaClubPostItem` rendered here but deferred to Phase 6. `ArticleCard` = backend data only.

## Phase 3 — Profile area
- ✅ `MyProfile.tsx` (reference implementation)
- ✅ `EditProfile.tsx` (namespace: `editProfile`, + `common.save`) — labels, placeholders, save button, update toasts. `CustomDatePicker` = native, no static text.
- ✅ `AddPartner.tsx` (namespace: `addPartner`) — static strings + `partnerData.ts` text converted to i18n keys (title, benefits, steps); `code` kept literal.
- ✅ `Notifications.tsx` — NO static UI text (renders `item.title`/`item.message` only). `notificationData.ts` is placeholder/dummy data (real notifications are backend/FCM) → not translated. No changes needed.
- ✅ `Support.tsx` (namespace: `support`) — category labels (keyed), header/subtitle, message field, submit button, contact line, all 4 toasts. Email kept literal.
- ✅ `AboutVivaMama.tsx` (namespace: `about`) — hero/section titles + bodies, version, copyright (with `{{year}}`). Brand names kept literal.

## Phase 4 — Health-tracking logs
- ✅ `MoodLog.tsx` (namespace: `moodLog`) + `MoodFaceSelector` (`t(option.label)`) + `moodData.ts` labels/captions → keys. `MoodDateStrip` = dates only, no static text. Date format strings left to `toLocaleDateString`.
- ⏭️ `FeedingLog.tsx` — DEAD/unreachable. Only navigation source is the infant tab (`DashboardInfantTab`/`FLInfantCheckInOptions`/`infantData`), which is itself dead. Registered in AppStack but no live path. Skipped. (Revisit if infant tab is ever wired up.)
- ⏭️ `VaccinationLog.tsx` — DEAD/unreachable, same reason. Skipped.
- ⏭️ `Recommendations.tsx` / `RecommendationDetails.tsx` (+ `recommendations/FLItemRecommendation`) — DEAD/unreachable. Only nav source is the commented-out Recommendations block in `DashboardMotherTab` (lines ~588-631). `recommendationsData` is placeholder. Skipped. (`IndividualRecoveryCard` already done in Phase 2.)
- ✅ `AboutRecoveryScore.tsx` (namespace: `aboutScore`; reuses `vivaScore.disclaimer2/3/4`). Reachable via NNWoman/RecoveryScoreBriefInfo "Learn More".
- ⏭️ `FullReport.tsx` — DEAD/unreachable (no live navigation). Skipped.
- `VivaScoreGauge` = gauge/number, no static text. `WeekCycle` = commented out (unused). `bottomSheet/*` done in Phase 2.

## Phase 5 — Articles & content browsing
- ⏭️ `CategoryArticles.tsx` / `SubCategoryArticles.tsx` (+ `community/FLCategoryItem`, `FLSubCategoryItem`, `FLCategoryArticle`) — DEAD/unreachable (the community item components are never rendered). Skipped.
- ✅ `ArticleDetails.tsx` (namespace: `articleDetails`) — "Article not found.", "Reviewed by"/"Written by" (names interpolated). Body/title = backend content.
- ✅ `ExpertDetails.tsx` (namespace: `expertDetails`; reuses `experts.yearsExperience`, `common.*`, `subscription.*`) — loading/not-found, card labels (Qualification/About/Speciality/Remuneration), fee, booking buttons + toasts. Expert name/bio/qualification = backend.
- ✅ `ProductDetails.tsx` (namespace: `productDetails`, + `common.goBack`) — loading/not-found, price range, week recommendation, description, disclaimer, "Buy at Amazon". Product name/category/description = backend.

## Phase 6 — Viva Club (community)
- ✅ `VivaClubPost.tsx` / `VivaClubPostDetails.tsx` / `CreatePost.tsx` (namespace: `vivaClub`) — disclaimers, Create/Post buttons, comments ("Comments (n)", "No comments yet.", placeholder), all toasts. `FLVivaClubPostItem` = backend data (null `user` guard added earlier; `vivaClub.anonymous` fallback). `vivaClubData.ts` = dead placeholder (pre-existing tsc errors, not translated).

## Phase 7 — Chat / Viva AI
- ✅ `ChatWithVivaAI.tsx` static chrome (namespace: `chat`) — intro "Viva, your personal assistant", all toasts, retry, age-validation. ⚠️ Message/flow content stays from backend (not translated). Pulled forward (user-flagged).
- ✅ `ChatInputBar.tsx` (placeholders, "X selected, click to submit")
- ✅ `ChatDropdownMenu.tsx` (Bookmarks / About labels; option keys unchanged)
- ✅ chat components: `chatBubble/AnimatedBubble` + `StaticBubble` ("Select Delivery Date", "I'm Not Pregnant Yet"), `ModelSelector` ("Select AI Model"; model names = brand), `TypingIndicator` ("Viva is thinking..."). `MessageWithLinks` / `chatBubble/index` = no static text.
- ✅ `BookmarkedMessages.tsx` (namespace: `bookmarks`; reuses `common.error/cancel`, `chat.bookmarkRemoved`) — toasts, delete-confirm Alert, empty state.
- ✅ `ConsultationRating.tsx` (namespace: `consultationRating`) — title/subtitle, star labels, review placeholder, submit, feedback toasts.

## Phase 8 — Cleanup
- ✅ Translate navigation titles & tab labels (namespace: `nav`) — `AppStack` header titles, `DashboardTabs` tab labels (Home/Viva AI/Experts/Products/Contents), `OnboardingStack` SubscriptionDetails. Titles on `headerShown:false` screens left as-is (not visible).
- ✅ Grep for leftover hardcoded strings — repo-wide own-line + inline + placeholder/title/toast/Alert sweep across all LIVE screens & components: **clean** (only matches were commented-out code).
- ⏭️ Dead files to delete after confirm: `ChatWithVivaAIOld.tsx`, `Services copy.tsx`→? (live, keep), `test.html`, + unreachable screens/components (FeedingLog, VaccinationLog, Recommendations, RecommendationDetails, FullReport, CategoryArticles, SubCategoryArticles, DashboardInfantTab, FLInfantCheckInOptions, community/FL*, recommendations/FL*). Data files: infantData, recommendationsData, vivaClubData, notificationData (placeholder).

---

## ✅ i18n rollout COMPLETE (Phases 1–8)
All reachable screens' static UI translated to en/hi. Dead/unreachable screens skipped (documented above). Backend content (articles, chat messages, expert/product data, questionnaire) intentionally not translated. Language switch via first-login gate + MyProfile menu.
