# Publish From VS Code

This guide assumes you have VS Code, Git, and a GitHub account.

## 1. Open The Folder

In VS Code:

1. Choose **File > Open Folder...**
2. Open the `wiki-autoresearch` folder.

The folder should contain `SKILL.md`, `README.md`, `scripts/`, `references/`, and `evals/`.

## 2. Review The Package

Open these files and make any personal edits before publishing:

- `README.md`
- `SKILL.md`
- `LICENSE`
- `package.json`

In particular, change the license holder if you do not want it to say `Rob`.

## 3. Run A Local Check

Open VS Code's integrated terminal:

```bash
npm run check
```

This checks that the bundled Node scripts parse correctly.

## 4. Initialize Git

In the VS Code terminal:

```bash
git init
git add .
git commit -m "Initial release of wiki-autoresearch skill"
```

## 5. Publish To GitHub From VS Code

In VS Code:

1. Open the **Source Control** panel.
2. Click **Publish Branch** or **Publish to GitHub**.
3. Choose **Public** if you want others to use it.
4. Name the repository `wiki-autoresearch`.
5. Let VS Code create the remote and push the first commit.

If VS Code asks whether to sign in to GitHub, follow the browser login flow.

## 6. Check The GitHub Page

After publishing, open the repository on GitHub and check:

- The README renders clearly.
- The repository root shows `SKILL.md`.
- The `scripts/`, `references/`, and `evals/` folders are present.
- The license looks right.

## 7. Suggested Release

Create a GitHub release after the first public version:

1. Go to **Releases** on GitHub.
2. Click **Draft a new release**.
3. Tag version: `v0.1.0`.
4. Title: `v0.1.0 - Initial public release`.
5. Mention that this is an early skill for agent-maintained Obsidian LLM wikis.

## 8. Suggested Announcement

```text
I published wiki-autoresearch, an agent skill for Obsidian LLM wikis.

It runs bounded keep/discard improvement cycles over a vault: finding open questions, contradictions, weak provenance, orphan pages, stale claims, and missing synthesis opportunities, then improving one reviewable thing at a time.

Repo: https://github.com/YOUR-USERNAME/wiki-autoresearch
```
