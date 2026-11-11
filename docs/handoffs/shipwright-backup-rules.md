# Hand-off shipwright: backup-rules
Branch feat/shipwright-backup-rules. Added res/xml/data_extraction_rules.xml (cloud-backup and device-transfer) and res/xml/backup_rules.xml, wired in the manifest; allowBackup stays true.
Excluded (domain root): app_webview/Default/Service Worker, app_webview/Default/Cache, app_webview/Default/Code Cache, app_webview/Default/GPUCache; plus the whole cache domain.
Kept (no rule, so backed up): app_webview/Default/Local Storage and app_webview/Default/IndexedDB.
Test: tests/native/backupRules.test.ts (manifest refs, excluded paths, kept paths not excluded).
Android debug build: not run (no Android SDK or network in this cloud session). npm test and npm run build pass.
