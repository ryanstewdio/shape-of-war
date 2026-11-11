# Shipwright: backup-rules

Create and check out branch feat/shipwright-backup-rules before any edit. Never push main (main is protected; Morpheus merges your branch through a PR). You have explicit go ahead now: call add_repo for ryanstewdio/shape-of-war with push access before your first commit, so the push at the end works. If git remote -v is empty first run: git remote add origin https://github.com/ryanstewdio/shape-of-war.git

Model: sonnet
Owned paths: android/app/src/main/AndroidManifest.xml, android/app/src/main/res/xml/ (new backup rule files), tests/native/
Do not touch: everything else
Read first: android/app/src/main/AndroidManifest.xml (allowBackup true), Android docs for dataExtractionRules (API 31 and up) and fullBackupContent (older)

## Goal
Ryan reinstalled the Android app and Android Auto Backup restored the old WebView data, including a stale service worker cache from an earlier PWA build, so the new app showed the old game. He ruled 2026-11-11: keep progress backed up, but never back up the WebView's offline cache.

## Acceptance
- Add data_extraction_rules.xml (cloud backup and device transfer) and backup_rules.xml (fullBackupContent for older Android), referenced from the manifest, that exclude the WebView service worker, cache and code cache directories (for example app_webview/Default/Service Worker, app_webview/Default/Cache, app_webview/Default/Code Cache, and the cache domain) while keeping localStorage and IndexedDB, where progress lives. State the exact paths you exclude and keep.
- allowBackup stays true. The Android debug build still succeeds if you can run it (say if you cannot).
- A test reads the manifest and the rule files and checks the references and the excluded paths. npm test and npm run build pass on the branch (accepted generator perf exception aside). Hand off at docs/handoffs/shipwright-backup-rules.md under 8 lines. Commit and push the branch. Stop.

## Rules
No em or en dashes.
