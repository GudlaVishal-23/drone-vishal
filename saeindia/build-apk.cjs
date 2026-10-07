const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=======================================================');
console.log('📦 SAE INDIA CROSS-PLATFORM APK BUILD PIPELINE');
console.log('=======================================================');

try {
  // 1. Build Web Assets
  console.log('\n[1/4] Building web assets (tsc && vite build)...');
  execSync('npm run build', { stdio: 'inherit' });

  // 2. Sync with Capacitor
  console.log('\n[2/4] Synchronizing with Capacitor Android...');
  execSync('npx cap sync android', { stdio: 'inherit' });

  // 3. Assemble Android Debug APK
  console.log('\n[3/4] Compiling Android Gradle Debug APK...');
  const isWindows = process.platform === 'win32';
  const gradlewCmd = isWindows ? 'gradlew.bat' : './gradlew';
  const androidDir = path.join(__dirname, 'android');

  execSync(`${gradlewCmd} assembleDebug`, {
    cwd: androidDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ANDROID_HOME: process.env.ANDROID_HOME || (
        isWindows
          ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
          : path.join(process.env.HOME || '', 'Library', 'Android', 'sdk')
      )
    }
  });

  // 4. Copy Output Artifact
  const sourceApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const targetApk = path.join(__dirname, 'saeindia-debug.apk');

  if (fs.existsSync(sourceApk)) {
    fs.copyFileSync(sourceApk, targetApk);
    console.log(`\n[4/4] SUCCESS: Debug APK generated and saved to: ${targetApk}`);
    console.log('=======================================================');
  } else {
    console.warn('\n[!] Warning: Gradle completed, but app-debug.apk was not found at expected path.');
  }
} catch (error) {
  console.error('\n❌ APK Build failed:', error.message);
  process.exit(1);
}
