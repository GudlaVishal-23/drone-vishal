---
name: saeindia-apk-build-and-sync
description: >-
  Provides runbook instructions for compiling the frontend web bundle, synchronizing
  assets with Capacitor Android, and generating the debug APK file (saeindia-debug.apk).
  Use when building or updating the Android application.
---

# SAE INDIA Android Build & Capacitor Sync Runbook

This skill outlines the process for building the web assets and generating the Android APK for mobile field devices.

---

## 1. Prerequisites

- Node.js $\ge 18$ & NPM.
- Android SDK installed (or Android Studio with SDK build tools 34+).
- Environment variable `ANDROID_HOME` pointing to the SDK directory.

---

## 2. Fast Build & Sync Procedure

### Step 1: Compile Web Assets
```powershell
npm run build
```
This runs `tsc && vite build`, outputting compiled assets to `dist/`.

### Step 2: Synchronize Capacitor Native Android Bridge
```powershell
npx cap sync android
```
This copies `dist/` web files into `android/app/src/main/assets/public/` and updates native Capacitor plugins.

### Step 3: Compile Android Debug APK
From the `android/` directory:
```powershell
cd android
./gradlew assembleDebug
cd ..
```
The output APK is generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`

Copy the built artifact to the project root:
```powershell
Copy-Item "android/app/build/outputs/apk/debug/app-debug.apk" "saeindia-debug.apk" -Force
```

---

## 3. Automated One-Step Script

The package scripts provide a unified command:

```powershell
npm run build:apk
```

---

## 4. Troubleshooting Build Issues

- **TypeScript Compilation Errors:** Address any missing imports or interface mismatches in `src/` prior to running `vite build`.
- **Gradle Daemon Out of Memory:** Add `org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m` in `android/gradle.properties`.
- **Android SDK Not Found:** Ensure `ANDROID_HOME` or `local.properties` contains `sdk.dir=C:\\Users\\...\\AppData\\Local\\Android\\Sdk`.
