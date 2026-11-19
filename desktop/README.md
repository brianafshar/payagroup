# PAYA Group — Windows desktop app

One installer for the gym's central PC: an Electron window around a bundled Django server
(`backend/desktop_entry.py`, built with PyInstaller) and the coach panel (`apps/web`). Data stays on the PC in
`%APPDATA%\PAYA Group` (SQLite database, uploaded files, secret key).

**First start** creates the head coach (`sarmoalem`) and the support admin (`admin`) with random passwords,
shows them once and saves them to `اطلاعات-ورود.txt` in the data folder. The head coach then adds coaches under
«تیم مربیان». Sign-in is by username only (no e-mail).

## Build the installer

CI builds it on `windows-latest` (`.github/workflows/windows-installer.yml`, artifact **PAYA-Group-Setup**).
Locally on Windows:

```bat
pnpm install && pnpm --filter @baseline/web exec vite build
cd backend && pip install -r requirements.txt pyinstaller && pyinstaller paya-server.spec --noconfirm
xcopy /E /I dist\paya-server ..\desktop\server-dist\paya-server
cd ..\desktop && npm install && npm run dist
```

WeasyPrint (program PDF) needs the Pango/GTK DLLs next to `paya-server.exe` (the workflow copies them from MSYS2).

## Run in development (any OS)

```bash
pnpm --filter @baseline/web exec vite build
cd desktop && npm install && PYTHON=python npm start
```

## Settings (environment of the server, or `backend/.env`)

| Variable | Purpose |
| --- | --- |
| `KAVENEGAR_API_KEY`, `KAVENEGAR_SENDER` | SMS with the program link («ارسال پیامکی») |
| `SITE_URL` | gym site; exercise names in the PDF link to `SITE_URL/training/<key>` (default `https://payagroup.org`) |
| `SITE_API_URL`, `SITE_API_KEY` | when the site has an upload API: PDFs are published there (`POST /pdfs`, answer `{"url": …}`); unset = the PDF is served by this PC (works only on the local network) |
