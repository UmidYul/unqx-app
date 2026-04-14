const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const path = require("path");
const fs = require("fs");

// Resolve symlinks (macOS /var → /private/var) to avoid Metro resolution failures
const projectRoot = fs.realpathSync(__dirname);
const config = getSentryExpoConfig(projectRoot);

module.exports = config;
