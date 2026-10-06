# Run in VS Code and publish with Firebase Hosting

This app checks and combines PDFs entirely in Chrome. Firebase Hosting serves the built HTML, CSS, JavaScript, fonts, sample data, and PDF worker over HTTPS. Your uploaded PDFs stay in your browser.

## 1. Install Node.js on Windows

Download the Node.js 24 LTS Windows Installer (.msi) from https://nodejs.org/en/download. Choose x64 for a normal Intel/AMD PC. Keep npm and the PATH option enabled during installation. Fully close VS Code and reopen it after the installer finishes.

In a new VS Code PowerShell terminal, check:

```powershell
node -v
npm.cmd -v
```

If `node` is not recognized, reopen VS Code after installing Node.js. If it is still not found, restart Windows and verify Node.js appears under Installed apps. This project requires Node.js; adding a Firebase project does not install Node.js on your PC.

## 2. Open the right project folder

Extract the ZIP. In VS Code choose File > Open Folder and select the inner `Tender_Document_Package_Builder` folder. You should see `package.json`, `firebase.json`, `src`, and `dist` directly in the Explorer.

Use this terminal check if needed:

```powershell
Get-ChildItem package.json, firebase.json
```

If either file is missing, you are probably in the outer Downloads/extraction folder; open the inner project folder.

## 3. Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Keep the terminal running and open the Local URL printed by Vite, normally http://localhost:5173/. Press Ctrl+C to stop it. A built `dist` is also included, but do not double-click its index.html; browser modules need a local server or HTTPS host.

To run the existing checks:

```powershell
npm.cmd test
```

## 4. Choose your Firebase project

Open https://console.firebase.google.com/ and create or choose the project you intend to publish to. Select the Hosting product. Find the **Project ID** in Project settings > General. The Project ID may differ from the project display name.

Sign in on your own PC using the normal Firebase CLI login below. You do not need to give an account password or access token to anyone.

## 5. Deploy from the VS Code terminal

Stop the dev server with Ctrl+C, then run:

```powershell
npm.cmd run build
npm.cmd install -g firebase-tools
firebase.cmd login
firebase.cmd projects:list
```

Replace YOUR_PROJECT_ID below with the exact ID from your Firebase console/project list, then run:

```powershell
firebase.cmd deploy --only hosting --project YOUR_PROJECT_ID
```

For example, if your actual Project ID were `tender-demo-123`, the last command would end with `--project tender-demo-123`. That example is not an existing or verified project.

The ZIP already includes `firebase.json`, so `firebase init` is not required. The Hosting directory is `dist`; the build command recreates it. There are no functions, Firestore, Realtime Database, or Cloud Storage services to configure. Static Firebase Hosting fits the supplied browser-only requirements.

After deployment finishes, open the exact Hosting URL printed by the CLI. Check it in a private/incognito Chrome window, try loading the sample, and download a package. Your Firebase console Hosting page shows the deployment.

## If you already ran firebase init

Keep `public` set to `dist` in firebase.json. If prompted to overwrite dist/index.html, choose No. If it was overwritten, run `npm.cmd run build` again before deploying. Choose your own existing project. This app has one root page and does not need a catch-all rewrite or GitHub automatic deployment for the first publish.

## Updating your site

After editing code, rebuild and deploy again:

```powershell
npm.cmd run build
firebase.cmd deploy --only hosting --project YOUR_PROJECT_ID
```

## GitHub

The archive includes the real source history in TenderDesk_History.bundle, including the Firebase setup change. To preserve it in a new checkout:

```powershell
git clone --branch main TenderDesk_History.bundle tender-desk
cd tender-desk
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/devfest-YOUR_REGISTRATION.git
git push -u origin main
```

Create the public GitHub repository in your own account before pushing. Replace the uppercase placeholders. A clone needs `npm.cmd install` and `npm.cmd run build` because dist is intentionally untracked; firebase.json and all source/configuration files are tracked.

Enter your real name and registration number in README.md and add the requested genuine status screenshot before submission. Keep actual commit timestamps and follow the organizer's deadline; this setup does not establish contest eligibility.

Official references:
- https://nodejs.org/en/download
- https://firebase.google.com/docs/hosting/quickstart
- https://firebase.google.com/docs/cli
