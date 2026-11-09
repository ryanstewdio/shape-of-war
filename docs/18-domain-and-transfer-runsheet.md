# Domain and transfer runsheet: play.shapelegend.com and ryanstewdio/shape-of-war

Written by Fable 2026-11-09. Ryan performs every browser step. Lead runs every Terminal step through the dispatcher unless the step says "Terminal, you".

Rulings this follows (Ryan, 2026-11-08 and 09): separate GitHub owner `ryanstewdio` (an organization, Ryan's `stoopstoop` is admin); tester link moves to a custom domain; game URL `play.shapelegend.com`; registrar Hostinger; PR only merges once the ruleset is on (that ruleset is the Furiosa runsheet's step 1, not this one).

## Bad news first
- Saves are lost once. play.shapelegend.com is a new origin, so every install (yours and the testers') starts fresh after reinstalling.
- The old link dies at the transfer. GitHub does not redirect Pages sites when a repository moves, so https://stoopstoop.github.io/shape-of-war/ returns 404 from step D3 on. The game is offline from D3 until D4 finishes (minutes, or up to 24 hours if DNS is slow).
- Every control label below is Assumed. If a page differs from the step, stop and paste what it shows.
- Leave the apex `shapelegend.com` and `www` records alone. They stay on Hostinger parking for a later landing page.

## Group D1: domain verification and DNS (start now, before anything else)
D1.1 Browser, github.com. Open https://github.com/organizations/ryanstewdio/settings/pages
- Expected: a "Verified domains" section with "Add a domain".
- Stop: you see a repository's Pages settings instead, or no Pages entry in the sidebar. Paste the sidebar.
D1.2 Click "Add a domain", type `shapelegend.com`, click "Add domain".
- Expected: instructions to add a TXT record. Host name `_github-pages-challenge-ryanstewdio` and a long value.
- Paste back: the host name and the value exactly. Do not click Verify yet.
D1.3 Browser, hPanel (hpanel.hostinger.com). Domains, then shapelegend.com, then "DNS / Nameservers" (Assumed label). Open the DNS records list.
- Paste back: every existing record (type, name, points to). Look for a record named `*`.
- Stop: a `*` record exists. Paste it; GitHub warns wildcard records allow takeovers. Lead says whether to delete it.
D1.4 In the same DNS records page, add a TXT record: Name `_github-pages-challenge-ryanstewdio`, Value the value from D1.2, TTL default. Save.
D1.5 Add a CNAME record: Name `play`, Target `ryanstewdio.github.io`, TTL default. Save. If hPanel adds a trailing dot or the full domain, that is fine.
- Paste back: the TXT and CNAME rows as hPanel shows them.
D1.6 Terminal, you, any window, one line:
`dig +short TXT _github-pages-challenge-ryanstewdio.shapelegend.com; dig +short CNAME play.shapelegend.com; dig +short A zz-check.shapelegend.com; echo done`
- Expected: the TXT value in quotes, then `ryanstewdio.github.io.`, then nothing for the zz-check line, then `done`.
- Stop: the zz-check line prints an address (a wildcard is live). Paste it.
- If the first two lines are empty, wait 15 minutes and run it again; up to 24 hours is normal.
D1.7 Back on the page from D1.2, click "Verify".
- Expected: shapelegend.com listed as verified.
- Paste back: the status line.

## Group D2: the moving notice (after Lead says "go on to D2")
Lead lands Shipwright: domain-move first (the base path follows Pages, and a banner on any github.io copy points to play.shapelegend.com). It deploys to the old URL.
D2.1 Fold 7, inner screen. Open the installed game from the home screen while online, wait 10 seconds, close it fully, open it again.
- Expected: the build id in the corner equals the sha Lead names; the main menu shows the banner "Shape Legend has a new home: play.shapelegend.com ...".
- Paste back: build id, banner seen yes or no, banner readable yes or no.
D2.2 Message your testers. Draft, edit freely:
"Shape Legend is moving to https://play.shapelegend.com. The old link stops working soon. Open the new link, add it to your home screen, and delete the old icon. Progress does not carry over, sorry. Thanks for testing."
- Paste back: "sent".

## Group D3: the transfer (after Lead says "go on to D3")
Lead first confirms no dispatcher or cloud job is running and main is pushed.
D3.1 Browser. Open https://github.com/stoopstoop/shape-of-war/settings, scroll to "Danger Zone", click "Transfer".
D3.2 Choose "Select one of my organizations" (Assumed), pick `ryanstewdio`, type `stoopstoop/shape-of-war` to confirm, click the transfer button.
- Expected: you land on https://github.com/ryanstewdio/shape-of-war.
- Stop: an error, or any prompt about forks or name clashes. Paste it.
- Paste back: the new URL from the address bar.
D3.3 Lead then runs through the dispatcher: `git remote set-url origin https://github.com/ryanstewdio/shape-of-war.git && git fetch origin && git rev-parse origin/main`. Nothing for you to do.

## Group D4: Pages, domain and protections on the new repo (after D3.3)
D4.1 Browser. Open https://github.com/ryanstewdio/shape-of-war/settings/pages
- Expected: Source "GitHub Actions". If it reads "Deploy from a branch" or "None", set it to "GitHub Actions".
- Paste back: the Source line.
D4.2 Under "Custom domain" type `play.shapelegend.com`, click Save.
- Expected: a DNS check that ends with "DNS check successful" (Assumed wording).
- Stop: a check failure that persists 15 minutes. Paste it.
D4.3 Tick "Enforce HTTPS" once it is clickable. It can stay greyed out for up to an hour while the certificate is issued; come back to it.
- Paste back: the custom domain line and the Enforce HTTPS state.
D4.4 Open https://github.com/ryanstewdio/shape-of-war/settings/security_analysis (Assumed path; "Code security" in the sidebar).
- Expected: Secret scanning and Push protection both enabled. Enable either if it is off.
- Paste back: both lines.
D4.5 Claude cloud sessions need their GitHub app on the new owner. Open https://github.com/organizations/ryanstewdio/settings/installations
- If "Claude" is listed: click Configure, set "Only select repositories" to `shape-of-war` alone, Save.
- If not listed: tell Lead; the next cloud launch will ask for it and Lead gives you the prompt then.
- Stop: any other app listed with access to all repositories. Paste the list.
- Paste back: the installed app names and their repository access lines.
D4.6 Lead then runs `gh workflow run deploy.yml --ref main` and reads the run by id. The build now uses base `/`.

## Group D5: device check on the new home (after Lead says "go on to D5")
D5.1 Fold 7. In Chrome open https://play.shapelegend.com/
- Expected: the game loads over https with the build id Lead names, no banner.
D5.2 Chrome menu, "Add to home screen" or "Install app". Open it from the new icon. Play one level.
D5.3 Turn on flight mode, close the game, open it again from the icon.
- Expected: it opens offline.
D5.4 Delete the old icon.
- Paste back, one line per field:
  - url_https: yes or no
  - build_id: the corner text
  - banner_absent: yes or no
  - installed: yes or no
  - level_played: yes or no, fps from the corner if shown
  - offline_open: yes or no
  - old_icon_removed: yes or no

## After D5
Lead hands the STATUS and DECISIONS lines (live URL, repo owner) to whichever session owns those files, and the Furiosa runsheet starts at its step 0 with `ryanstewdio/shape-of-war` and check name `gate`.
