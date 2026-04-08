/**
 * Patches expo-notifications to not throw on Android in Expo Go.
 *
 * SDK 53 removed push notification support from Expo Go and the library
 * throws an Error at module-evaluation time via a side-effect file
 * (DevicePushTokenAutoRegistration.fx.js → addPushTokenListener → warnOfExpoGoPushUsage).
 * This crash cannot be guarded against from user-land code because it
 * fires before the dynamic import() promise resolves.
 *
 * This patch converts the throw into a console.warn so the app can
 * continue running in Expo Go during development.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(
    __dirname,
    '..',
    'node_modules',
    'expo-notifications',
    'build',
    'warnOfExpoGoPushUsage.js',
);

const THROW_LINE = `throw new Error(message);`;
const WARN_LINE = `didWarn = true; console.warn(message);`;

try {
    if (!fs.existsSync(filePath)) {
        // Package not installed — nothing to patch.
        process.exit(0);
    }

    let content = fs.readFileSync(filePath, 'utf8');

    if (!content.includes(THROW_LINE)) {
        // Already patched or file structure changed.
        process.exit(0);
    }

    content = content.replace(THROW_LINE, WARN_LINE);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[patch] expo-notifications: converted Android Expo Go throw → console.warn');
} catch (err) {
    console.warn('[patch] expo-notifications: patch failed, continuing anyway —', err.message);
}
