## Google Play Data Safety - Permission Declaration

### NFC
- Purpose: read and write NFC tags for digital business cards
- Data handling: no NFC payload is shared with third parties by default
- Optional: yes, app remains usable without NFC (QR flow)

### CAMERA
- Purpose: scan QR codes
- Data handling: camera stream is used for scanning only
- Optional: yes

### INTERNET
- Purpose: synchronize profile, analytics, and account data with UNQX backend
- Data handling: transmitted to UNQX servers over HTTPS
- Optional: required for cloud sync and analytics

### VIBRATE
- Purpose: haptic feedback for NFC operations
- Data handling: no data collected
- Optional: yes

### USE_BIOMETRIC / USE_FINGERPRINT
- Purpose: optional app unlock with biometrics
- Data handling: biometric data never leaves the device; processed by OS APIs only
- Optional: yes
