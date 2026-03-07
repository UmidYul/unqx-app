## App Review Notes (Apple)

NFC is used for:
1. Reading user NFC tags in UNQX flows (NTAG-compatible tags)
2. Writing a user page URL in format `https://unqx.uz/SLUG` to an NFC tag
3. Verifying tag state after write operations

Please test NFC features on a physical device with NFC support.

Test Account Credentials:
- Login: review@unqx.uz
- Password: UnqxReview2024!
- Test slug: TST000

The review account should have an active Premium plan and a linked wristband in staging/review backend.

iOS payment compliance note:
- iOS app does not expose direct in-app links to third-party payment processors.
- Users are redirected to the official website flow where applicable.
