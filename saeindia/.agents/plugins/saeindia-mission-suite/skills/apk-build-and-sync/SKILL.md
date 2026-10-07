---
name: apk-build-and-sync
description: >-
  Builds web assets, synchronizes Capacitor Android bridge, and produces debug APK.
---

# Android APK Build & Sync

1. Web compile: `npm run build`
2. Sync native assets: `npx cap sync android`
3. Assemble APK: `cd android && ./gradlew assembleDebug && cd ..`
4. Copy debug output:
   `cp android/app/build/outputs/apk/debug/app-debug.apk saeindia-debug.apk`
