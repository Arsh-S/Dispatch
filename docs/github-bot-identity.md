# GitHub Bot Identity for Dispatch PRs

When the Slack bot (or constructor) creates pull requests, you can have them appear as **Dispatch Agent** instead of your personal GitHub account—similar to how Cursor shows "cursor[bot]" or Claude shows "claude[bot]".

## How It Works

- **Commit author**: Controlled by `DISPATCH_GIT_AUTHOR_NAME` and `DISPATCH_GIT_AUTHOR_EMAIL`. Commits will show this identity in the history.
- **PR author**: Determined by who owns the `GITHUB_TOKEN`. A personal PAT shows your account; a GitHub App token shows the app (e.g. `Dispatch[bot]`).

## Option 1: GitHub App (Recommended)

Like Cursor and Claude, use a GitHub App so PRs appear as `Dispatch[bot]`.

1. **Create a GitHub App** (org or user):
   - Go to **Settings → Developer settings → GitHub Apps → New GitHub App**
   - Name: `Dispatch` (or similar)
   - Homepage URL: your Dispatch URL or `https://github.com`
   - Permissions:
     - **Repository permissions**: Contents (Read and write), Pull requests (Read and write), Issues (Read and write), Metadata (Read-only)
   - Generate a private key and save it

2. **Install the app** on the org/repos where Dispatch will create PRs.

3. **Generate an installation token**:
   ```bash
   cd backend
   GITHUB_APP_ID=123 \
   GITHUB_APP_INSTALLATION_ID=456 \
   GITHUB_APP_PRIVATE_KEY="$(cat /path/to/private-key.pem)" \
   pnpm setup:github-app --identity
   ```
   This outputs `GITHUB_TOKEN` and (with `--identity`) `DISPATCH_GIT_AUTHOR_NAME` / `DISPATCH_GIT_AUTHOR_EMAIL`. Add them to `.env`.
   - Or use `GITHUB_APP_PRIVATE_KEY_PATH=./private-key.pem` instead of pasting the key.
   - Token expires in ~1 hour; for production, generate tokens on demand or use a refresh flow.

4. **Optional — use the app’s identity for commits**:
   Run `pnpm setup:github-app --identity` to get the correct `DISPATCH_GIT_AUTHOR_*` values for your app.

## Option 2: Machine User

Create a dedicated GitHub account (e.g. `dispatch-agent`) and use its PAT.

1. Create a new GitHub account (e.g. `dispatch-agent`).
2. Add it as a collaborator (or org member) with write access to the target repos.
3. Create a fine-grained PAT or classic PAT with `repo` scope.
4. Set `GITHUB_TOKEN` to this token.
5. PRs will show as `dispatch-agent`; commits use `DISPATCH_GIT_AUTHOR_NAME` / `DISPATCH_GIT_AUTHOR_EMAIL` (default: "Dispatch Agent").

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DISPATCH_GIT_AUTHOR_NAME` | `Dispatch Agent` | Name shown as commit author |
| `DISPATCH_GIT_AUTHOR_EMAIL` | `dispatch-agent@dispatch.ai` | Email for commit author |

These apply to both local constructor runs and Blaxel sandbox runs.
