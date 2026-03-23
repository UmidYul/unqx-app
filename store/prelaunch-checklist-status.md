# UNQX Prelaunch Status

Date: 2026-03-22

## Section 2 - App Store requirements
- [x] NSUsageDescription texts made specific in `app.json`
- [x] NFC entitlement present in `app.json`
- [x] App Review Notes draft created in `store/app-review-notes.md`
- [x] iOS external payment risk reduced: iOS wristband flow now routes to `https://unqx.uz/#pricing` in `src/components/profile/WristbandPage.tsx`
- [ ] Real Apple review test account must be created on backend and verified manually
- [ ] App Store screenshots and optional preview video must be produced/uploaded manually
- [x] App Store metadata draft created in `store/app-store-metadata.md`

## Section 3 - Google Play requirements
- [x] Play metadata draft created in `store/play-store-metadata.md`
- [x] Data Safety permission declaration draft created in `store/google-play-data-safety.md`
- [ ] Audience 18+ must be set in Play Console manually
- [ ] Feature Graphic and screenshots must be created/uploaded manually

## Section 4 - Legal documents
- [x] Privacy Policy created: `docs/privacy-policy.md`
- [x] Terms of Service created: `docs/terms-of-service.md`
- [x] Refund Policy created: `docs/refund-policy.md`
- [x] Legal links added in registration and profile screens
- [ ] Publish legal pages on website routes (`/privacy`, `/terms`, `/refund`) manually

## Section 5 - Onboarding and consent
- [x] Registration consent checkbox added and required before submit in `app/register.tsx`
- [x] Registration has links to Terms/Privacy
- [x] Permission pre-explanation wording improved in onboarding for NFC/push in `src/screens/OnboardingScreen.tsx`
- [ ] Camera permission pre-prompt not implemented because camera permission request flow is not present in current codebase

## Section 6 - Final checklist (code-level)
- [x] TypeScript verification passed: `npx tsc --noEmit` (2026-03-22)
- [x] No TODO/FIXME in app/src code
- [x] No unguarded `console.*` in app/src code
- [x] iOS payment UX avoids direct Payme/Click wording in iOS order form
- [ ] Device-level crash testing (fresh install/slow network/permission denial) still required manually

## Section 7 - Build and submit
- [x] Production EAS profile already aligned for store/app-bundle build
- [ ] Run `eas build --platform ios --profile production` manually (requires Apple credentials)
- [ ] Run `eas submit --platform ios` manually
- [x] Local Android release bundle built successfully: `android/app/build/outputs/bundle/release/app-release.aab` (2026-03-22)
- [ ] Run `eas build --platform android --profile production` manually
- [ ] Run `eas submit --platform android` manually
