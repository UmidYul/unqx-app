#!/usr/bin/env bash
set -euo pipefail
# Usage: ./scripts/build-ios-ipa.sh [scheme] [archive-path] [export-path]
SCHEME=${1:-UNQX}
ARCHIVE_PATH=${2:-./ios/build/UNQX.xcarchive}
EXPORT_PATH=${3:-./ios/build}
WORKSPACE=ios/UNQX.xcworkspace

mkdir -p "$(dirname "$ARCHIVE_PATH")"

xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release -archivePath "$ARCHIVE_PATH" archive

xcodebuild -exportArchive -archivePath "$ARCHIVE_PATH" -exportPath "$EXPORT_PATH" -exportOptionsPlist ios/exportOptions.plist

echo "IPA exported to $EXPORT_PATH"
