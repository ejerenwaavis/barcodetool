---
name: deploy-barcodetool
description: Step-by-step deployment workflow for the barcodetool project, including pre-flight checks, local builds, git push, and Namecheap remote restart via ssh aceddivision.
---

# Deploy barcodetool

Use this skill whenever you need to deploy the barcodetool project to production.

## Deployment Workflow

Follow these exact steps in order when the user asks you to deploy or run the build process:

1. **Pre-flight Safety Check**:
   - Run backend syntax check: `node --check server.js` to ensure the server will not crash on boot.
   - Run frontend build: `npm run build` locally in the workspace.
   - **CRITICAL**: If either command fails, HALT the deployment immediately. Do not push. Fix the errors before proceeding.
2. **Sync Folders**:
   - If React or frontend assets are built into `public_html`, ensure `public` and `public_html` are synchronized as required.
3. **Commit & Push**:
   - Commit the latest changes and built files to Git.
   - Run `git push origin main`.
4. **Deploy to Namecheap**:
   - Run SSH command to pull and restart the app on the remote server via configured `aceddivision` SSH alias:
     `ssh -o BatchMode=yes aceddivision 'source /home/acedzagz/nodevenv/barcodetool/10/bin/activate && cd /home/acedzagz/barcodetool && CHANGED=$(git diff --name-only HEAD origin/main | grep -E "package(-lock)?\.json") && git pull origin main && if [ -n "$CHANGED" ]; then echo "Dependencies changed, running npm ci..."; npm ci --omit=dev; fi && touch tmp/restart.txt'`
5. **Verify**:
   - Confirm to the user that the app has been safely checked, built, pushed, and restarted remotely on Namecheap.
