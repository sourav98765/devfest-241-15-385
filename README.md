# Tender Document Package Builder

A fresh, frontend-only app for the supplied AI DevFest tender problem. All PDF bytes, checks, and package generation stay in the browser; there is no backend, database, serverless function, API key, or document upload service.

Participant name: **Fill in your name before submitting.**
Registration number: **Fill in your registration number before submitting.**
Live website: https://tender-package-builder.itachii9908578.chatgpt.site
Firebase Hosting URL: **Add the URL printed after deploying to your own project.**

## Run in VS Code

Install Node.js 24 LTS. Open this folder in VS Code, then:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local link printed by Vite. Run `npm.cmd test` for validation tests, and `npm.cmd run build` for the static `dist/` output. `npm.cmd run preview` previews the build. See `SETUP_VSCODE.md` for Windows installation, troubleshooting, and complete deployment steps.

## Firebase Hosting

The included `firebase.json` publishes the `dist` folder. PDF processing runs in the browser, so this app does not need a Firebase database, Cloud Function, or SDK configuration.

After choosing your own project in the Firebase console, stop the dev server and run:

```powershell
npm.cmd run build
npm.cmd install -g firebase-tools
firebase.cmd login
firebase.cmd projects:list
firebase.cmd deploy --only hosting --project YOUR_PROJECT_ID
```

Replace `YOUR_PROJECT_ID` with the exact Project ID from your console or project list. The CLI prints the public Hosting URL after deployment. This folder already has its Hosting configuration; `firebase init` is not required.

## Main features

- Import arbitrary valid requirements JSON and sort requirements by `order`.
- Upload up to 30 PDFs / 50 MB, display filename and page count, view and remove files.
- One file per requirement and one requirement per file; undo or replace a match.
- Check missing documents, absent expiry dates, expiry before the tender deadline, and optional omissions. Expiry on the deadline remains valid.
- Detect byte-identical content even under different filenames and prevent duplicate assignments.
- Generate a single PDF with an English cover, all included document pages in requirement order, and a dedicated footer margin on every page.
- Switch the complete main interface between English and Bangla.

## Bonus features

Filename-based matching suggestions, CSV checklist export, and clear rejection of damaged or password-protected PDFs. Ambiguous filenames are left for the user to decide. No expiry dates are guessed.

## Sample data

`public/sample-pack/` is the supplied fictional organizer dataset. The sample contains an expired older trade license, an identical experience-certificate copy, a scanned declaration with an opaque filename, optional documents without files, and a PNG that should be rejected by the PDF upload control.

## AI tools and prompt

AI tool used: OpenAI Codex in ChatGPT.
Most useful prompt: “build web site for that” with the supplied problem statement, rulebook, and sample pack. Commit messages describe each real implementation step and retain this prompt. This repository was created afresh for this app; code and Git history from Smart Escape were not reused.

## Submission

Create a new public GitHub repository named `devfest-<registration-number>`. Include your real name, registration number, required screenshot, live link, final commit, and generated sample output. Use the actual commit timestamps and organizer deadline; this download does not establish contest eligibility or an on-time GitHub push.


## Sample package and verification

`output/T-2026-0417_Package.pdf` includes 16 pages: one cover and 15 document pages. It selects the valid 2026 trade license, uses 2027-06-30 for its expiry, uses 2026-12-31 for the bank certificate, keeps one experience-certificate copy, matches scan_0042.pdf to Signed Declaration, and omits the two unavailable optional documents. Filename prefixes do not determine package order.

To produce it in the app: load the sample pack, apply filename matches, select trade_license_2026.pdf for R01, select scan_0042.pdf for R10, enter the two dates above, then generate. The included PNG is rejected intentionally. The older license and duplicate PDF may remain in the library; they are excluded unless matched.

`node scripts/generate-sample.mjs` recreates the sample output locally using the exact PDF generator used by the app. This is a development utility, not a hosted server. The eight automated test groups cover the five statuses, date boundaries, schema rejection, arbitrary IDs/order, exact duplicates, reassignment, filename ambiguity, CSV escaping, bilingual labels, full PDF page counts, and rotated pages. Independent PDF inspection verified every footer, document order, and separation from content. The embedded trade-license page rendered pixel-identically to the source above the new footer band.

## Known limitations

- Expiry dates must be read from the documents and entered by staff; they are not inferred from filenames or OCR.
- The cover is English and uses a font for Latin text. Bangla cover text, custom stamps, index pages, and project save/reopen are not implemented.
- Visible form appearances are flattened into the combined document; interactive annotations are not preserved.
- Password-protected PDFs must be unlocked before upload. A page reload clears files and matches.
- Automated browser UI testing and a browser screenshot were unavailable in this session. Before submission, open the app in Chrome, exercise uploads and generation, and add a real screenshot of the document statuses to `screenshots/`.

## Libraries and licenses

App code is MIT. pdf-lib and @pdf-lib/fontkit are MIT; PDF.js is Apache-2.0; Noto Sans Bengali is SIL OFL; DejaVu Sans includes its copyright/license at public/assets/DejaVu-LICENSE.txt. Dependency versions are pinned in the lockfile.
