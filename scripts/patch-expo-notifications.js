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

// --- Patch 1: Android Expo Go throw → console.warn ---
const expoGoFile = path.join(
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
    if (fs.existsSync(expoGoFile)) {
        let content = fs.readFileSync(expoGoFile, 'utf8');
        if (content.includes(THROW_LINE)) {
            content = content.replace(THROW_LINE, WARN_LINE);
            fs.writeFileSync(expoGoFile, content, 'utf8');
            console.log('[patch] expo-notifications: converted Android Expo Go throw → console.warn');
        }
    }
} catch (err) {
    console.warn('[patch] expo-notifications: Expo Go patch failed —', err.message);
}

// --- Patch 2: iOS BadgeModule.swift RCTSharedApplication → UIApplication.shared ---
const badgeFile = path.join(
    __dirname,
    '..',
    'node_modules',
    'expo-notifications',
    'ios',
    'ExpoNotifications',
    'Badge',
    'BadgeModule.swift',
);

try {
    if (fs.existsSync(badgeFile)) {
        let content = fs.readFileSync(badgeFile, 'utf8');
        if (content.includes('RCTSharedApplication()')) {
            content = content.replace(
                /RCTSharedApplication\(\)\?\.applicationIconBadgeNumber/g,
                'UIApplication.shared.applicationIconBadgeNumber'
            );
            fs.writeFileSync(badgeFile, content, 'utf8');
            console.log('[patch] expo-notifications: replaced RCTSharedApplication() → UIApplication.shared in BadgeModule.swift');
        }
    }
} catch (err) {
    console.warn('[patch] expo-notifications: BadgeModule patch failed —', err.message);
}

// --- Patch 3: expo-image-picker RCTFatal/RCTErrorWithMessage → fatalError ---
const imagePickerFile = path.join(
    __dirname,
    '..',
    'node_modules',
    'expo-image-picker',
    'ios',
    'ImagePickerPermissionRequesters.swift',
);

try {
    if (fs.existsSync(imagePickerFile)) {
        let content = fs.readFileSync(imagePickerFile, 'utf8');
        if (content.includes('RCTFatal(RCTErrorWithMessage(')) {
            // Remove "internal import React" line that pulls in unavailable symbols
            content = content.replace(/^internal import React\n/m, '');
            // Replace RCTFatal(RCTErrorWithMessage(...)) with NSLog + assign denied
            content = content.replace(
                /RCTFatal\(RCTErrorWithMessage\("""[\s\S]*?"""\)\)/,
                'NSLog("[expo-image-picker] NSCameraUsageDescription is missing from Info.plist")'
            );
            fs.writeFileSync(imagePickerFile, content, 'utf8');
            console.log('[patch] expo-image-picker: replaced RCTFatal → NSLog in ImagePickerPermissionRequesters.swift');
        }
    }
} catch (err) {
    console.warn('[patch] expo-image-picker: patch failed —', err.message);
}

// --- Patch 4: @shopify/react-native-skia ViewScreenshotService.mm — add missing import ---
const skiaScreenshot = path.join(
    __dirname,
    '..',
    'node_modules',
    '@shopify',
    'react-native-skia',
    'apple',
    'ViewScreenshotService.mm',
);

try {
    if (fs.existsSync(skiaScreenshot)) {
        let content = fs.readFileSync(skiaScreenshot, 'utf8');
        if (content.includes('RCTFatal(') && !content.includes('#import <React/RCTAssert.h>')) {
            content = content.replace(
                '#import "ViewScreenshotService.h"',
                '#import "ViewScreenshotService.h"\n#import <React/RCTAssert.h>'
            );
            fs.writeFileSync(skiaScreenshot, content, 'utf8');
            console.log('[patch] react-native-skia: added RCTAssert.h import to ViewScreenshotService.mm');
        }
    }
} catch (err) {
    console.warn('[patch] react-native-skia: ViewScreenshotService patch failed —', err.message);
}

// --- Patch 5: @shopify/react-native-skia RNSkApplePlatformContext.mm — add missing import ---
const skiaPlatform = path.join(
    __dirname,
    '..',
    'node_modules',
    '@shopify',
    'react-native-skia',
    'apple',
    'RNSkApplePlatformContext.mm',
);

try {
    if (fs.existsSync(skiaPlatform)) {
        let content = fs.readFileSync(skiaPlatform, 'utf8');
        if (content.includes('RCTFatal(') && !content.includes('#import <React/RCTAssert.h>')) {
            content = content.replace(
                '#import <React/RCTUtils.h>',
                '#import <React/RCTUtils.h>\n#import <React/RCTAssert.h>'
            );
            fs.writeFileSync(skiaPlatform, content, 'utf8');
            console.log('[patch] react-native-skia: added RCTAssert.h import to RNSkApplePlatformContext.mm');
        }
    }
} catch (err) {
    console.warn('[patch] react-native-skia: RNSkApplePlatformContext patch failed —', err.message);
}

// --- Patch 6: expo resolveAppEntry — resolve symlinks for macOS /var vs /private/var ---
const resolveAppEntryFile = path.join(
    __dirname,
    '..',
    'node_modules',
    'expo',
    'scripts',
    'resolveAppEntry.js',
);

try {
    if (fs.existsSync(resolveAppEntryFile)) {
        let content = fs.readFileSync(resolveAppEntryFile, 'utf8');
        if (!content.includes('realpathSync')) {
            content = content.replace(
                "const { resolveEntryPoint } = require('@expo/config/paths');",
                "const { resolveEntryPoint } = require('@expo/config/paths');\nconst fs_resolve = require('fs');"
            );
            content = content.replace(
                'console.log(entry);',
                'try { entry = fs_resolve.realpathSync(entry); } catch (_) {}\nconsole.log(entry);'
            );
            fs.writeFileSync(resolveAppEntryFile, content, 'utf8');
            console.log('[patch] expo: added realpathSync to resolveAppEntry.js for macOS symlink fix');
        } else {
            console.log('[patch] expo: resolveAppEntry.js already patched');
        }
    }
} catch (err) {
    console.warn('[patch] expo: resolveAppEntry patch failed —', err.message);
}
