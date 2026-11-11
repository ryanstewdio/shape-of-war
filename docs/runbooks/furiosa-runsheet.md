# Furiosa runsheet: one task, start to finish

Furiosa is the Codex Cloud lane described in AGENTS.md. This runsheet is the order every task follows. Claude (the Lead) writes and reviews; Ryan does every step in a browser and the merge. Every control label on the Codex page is Assumed: if the page differs from a step, stop and paste what it shows.

## Known facts that shape the steps
- Codex caches the task container for up to 12 hours, built from main as it was when the cache was made, so a task can start hours behind main. There is no reset control on our environment page. Changing an environment variable did not bring the checkout to current main (issue 19 started at 8ba70ea while main was de4ba97), so the runsheet no longer changes one.
- The sandbox cannot git push, and the Codex Push control failed on issue 19 ("Failed to push changes"). Publishing works through the GitHub connector: create the issue's branch from current main on GitHub, upload only the allowed files as one commit, open one PR. Because that uploads whole files onto current main, Furiosa must stop if an allowed file changed on main after the start sha.
- Every PR body states its start sha. The Lead compares it with main at launch.
- The sandbox home folder cannot hold the npm cache: install with `npm ci --cache /tmp/npm-cache`.
- The environment allows one domain, registry.npmjs.org. Internet and package manager domains stay off.
- Furiosa commits are authored as Ryan's GitHub account (the ChatGPT connector writes with it).
- Publishing an environment can stall. Wait and look again later; never click publish repeatedly.
- A task thread is used once. Any follow up or rerun starts in a new chat. Any thread started outside this runsheet is abandoned, never continued.

## R0. Lead: the issue
The Lead drafts the issue on Template 1 (docs/runbooks/furiosa-templates.md) and sends it to Ryan as a file. Ryan approves or asks for changes.

## R1. Ryan: create the issue (browser, github.com)
1. Open https://github.com/ryanstewdio/shape-of-war/issues/new.
2. Title: the file's first line without `Title: `. Body: from `Issue id:` to the end line.
3. Create. Paste back the issue URL.
The Lead then corrects the issue number, branch name and end line if GitHub numbered it differently, and records main's sha.

## R2. Ryan: check the environment (browser, chatgpt.com/codex)
1. Open the environment `furiosa-shape-legend`.
2. Read, without changing: internet off; package manager domains off; additional domains exactly `registry.npmjs.org`; setup script empty.
3. If all four match, change nothing and do not publish. Stop and paste if any line differs or a prompt offers to widen access.
4. Paste back the four lines.

## R3. Ryan: launch the task
1. New chat. Never reuse an older thread.
2. Environment chip: `furiosa-shape-legend`. Never "Default environment".
3. Approval chip: "Ask for approval".
4. Model: your choice; it is recorded in the PR body.
5. Click "+", then GitHub, so the GitHub chip shows in the prompt box (the connector publishes the PR).
6. In the prompt box type `Title: <issue title>`, a new line, then paste the rendered issue body copied from the GitHub page, from `Issue id:` to `--- end of issue <n> body ---`. Nothing else.
7. Send. Approve only commands the issue lists. Approve GitHub connector calls only if they create the issue's branch, upload files on the allowed list to that branch, commit there, or open that one PR against main. Decline anything naming another file, main, a label, a merge or a deletion. Stop on any request for internet, another repository or wider access.

## R4. Ryan: the verdict
Wait for the task to finish. Paste back: the verdict lines verbatim, every prompt you answered with your answer, and the PR URL. If the verdict is blocked, open no PR and paste. If the only blocker is publishing, the Lead gives one follow up message for the same thread (the one exception to the one thread rule, because a new chat would not have the work); never use the Codex Push control.

## R5. Lead: the review
The Lead checks the PR's files against the allowed list, compares the start sha with main at launch, brings the branch up to date, reruns every command in a fresh worktree, posts a Template 2 review on the PR and gives Ryan a merge line with the reason. Up to three revision rounds, each a new chat.

## R6. Ryan: the merge (Terminal)
Only on the Lead's merge line: `gh pr merge <pr> --repo ryanstewdio/shape-of-war --merge`. If it refuses because the branch is out of date: `gh pr update-branch <pr> --repo ryanstewdio/shape-of-war`, wait for gate, merge again. Paste back the output line.

## R7. Lead: close out
The Lead closes the issue with a summary comment and hands the STATUS and DECISIONS lines to the session that owns those files.

## Stops (any step)
- A page that differs from a step.
- Any request for internet, another repository, a domain or wider GitHub access.
- A second fetch or install failure on the same issue.
- A merge refused naming the ruleset. The ruleset changes only on Ryan's word.
