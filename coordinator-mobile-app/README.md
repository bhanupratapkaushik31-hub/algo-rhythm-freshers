# 📱 Algo-Rhythm Coordinator Android App

Dedicated, native Android Scanner Application built for gate coordinators of **Algo-Rhythm Freshers 2026** (Team SCAI).

---

## ⚡ Key Features

1. **Persistent Authentication (Never Logs Out)**:
   - Once logged in with coordinator credentials, your session is saved locally in encrypted storage.
   - The app stays logged in across restarts and reboots. It will **never** log out automatically unless the user manually presses **Exit / Sign Out**.

2. **Ultra-Fast Native QR Code Scanner**:
   - Hardware-accelerated camera scanner with instant barcode detection.
   - Built-in Flashlight / Torch toggle button for dim lighting at the venue.
   - Front/Back camera switcher.
   - Haptic vibration and audio feedback on successful scan or error.

3. **Complete Attendee Profile & Verification**:
   - Fetches and displays student **photo**, **name**, **registration number**, **year**, **school**, and **modeling status**.
   - Validates payment and entry status in real time against your live Supabase database & API backend (`/api/entry/verify`).
   - Warns immediately if a ticket has already been used (shows original scan time and coordinator name).

4. **Manual Code Entry Fallback**:
   - Easily search and verify by Registration Number or Ticket ID if the QR code is smudged.

5. **Live Check-in Counter**:
   - Real-time counter of total attendees successfully checked in by the coordinator.

---

## 🚀 How to Build the Android APK

### Option A: 1-Click Cloud APK Build (Recommended - No Android Studio Needed)

1. Open a terminal in this directory:
   ```bash
   cd coordinator-mobile-app
   ```

2. Run the EAS build command:
   ```bash
   npx eas-cli build -p android --profile preview
   ```

3. Expo will compile the Android APK in the cloud and give you a direct download link and QR code to install the `.apk` directly on any Android phone!

---

### Option B: Test Live in 10 Seconds with Expo Go

1. Start the development server:
   ```bash
   npx expo start
   ```
2. Scan the terminal QR code with the **Expo Go** app on any Android device to run the app immediately.

---

## 🔒 Security & Database
- **No changes made to Web routes or Database tables.**
- Connects directly to production backend: `https://algo-rhythm-freshers.vercel.app`
- Authenticates using existing Coordinator accounts configured in the Supabase Admin portal.
