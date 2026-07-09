
  # Sistema PMS Reservas Hoteles

  This is a code bundle for Sistema PMS Reservas Hoteles. The original project is available at https://www.figma.com/design/54kXvKB7ZgTcNkUsViwyo3/Sistema-PMS-Reservas-Hoteles.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Vercel deployment

  Build command: `npm run build`

  Output directory: `dist`

  Required environment variables:

  - `GEMINI_API_KEY`: Gemini API key used only by the serverless `/api/genai-accountancy` endpoint.
  - `GEMINI_FALLBACK_MODELS`: optional comma-separated Gemini model fallback list.
  - `FX_RATES_SPREADSHEET_ID`: Google Sheet ID for the FX history. Default: `1PMCKSDqsBMum7o-C7KZ-YwNpJpZa9BPQ7223ag2Q_r`.
  - `FX_RATES_SHEET_NAME`: tab name containing the FX history. Default: `Rates`.
  - `GOOGLE_SHEETS_API_KEY`: optional, for reading a shared/public Google Sheet through the Google Sheets API.
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: optional, recommended for private Google Sheets and accepted by the Firebase Admin bridge when it belongs to the Firebase project.
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: optional, recommended for private Google Sheets and accepted by the Firebase Admin bridge. Keep the `\n` line breaks escaped in Vercel.
  - `VITE_FIREBASE_API_KEY`: Firebase web app API key.
  - `VITE_FIREBASE_AUTH_DOMAIN`: Firebase auth domain.
  - `VITE_FIREBASE_PROJECT_ID`: Firebase project ID. Also used by the Firebase Admin bridge when `FIREBASE_PROJECT_ID` is omitted.
  - `VITE_FIREBASE_STORAGE_BUCKET`: Firebase storage bucket.
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`: Firebase messaging sender ID.
  - `VITE_FIREBASE_APP_ID`: Firebase web app ID.
  - `VITE_FIREBASE_CREDENTIAL_STORE_ID`: optional frontend document ID for credentials. Default: `production-v3-root-baseline`.
  - `VITE_FIREBASE_PMS_STORE_ID`: optional frontend document ID for PMS operating data. Default: `test-v3-empty`.
  - `FIREBASE_PROJECT_ID`: optional server-side Firebase project ID. Falls back to `VITE_FIREBASE_PROJECT_ID`.
  - `FIREBASE_CLIENT_EMAIL`: optional server-side Firebase service account email. Falls back to `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
  - `FIREBASE_PRIVATE_KEY`: optional server-side Firebase private key. Falls back to `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.
  - `FIREBASE_CREDENTIAL_STORE_ID`: optional server-side credentials document ID. Falls back to `VITE_FIREBASE_CREDENTIAL_STORE_ID`.
  - `FIREBASE_PMS_STORE_ID`: optional server-side PMS document ID. Falls back to `VITE_FIREBASE_PMS_STORE_ID`.
  - `ZOHO_SMTP_USER`: Zoho sender email. Default: `info@luxurytentedcamp.com`.
  - `ZOHO_SMTP_PASSWORD`: Zoho app password for password reset emails.
  - `ZOHO_SMTP_HOST`: optional SMTP host. Default: `smtp.zoho.eu`.
  - `ZOHO_SMTP_PORT`: optional SMTP port. Default: `465`.

  FX rates are read from columns `Date`, `TZS_per_USD`, and `USD_per_TZS`. For private sheets, share the Google Sheet with the service account email as Viewer.

  Firebase stores are read and written by the Vercel `/api/firebase-store` serverless bridge using the Firestore REST API and the server-side Firebase service account. Firestore rules can stay locked because the browser no longer writes directly to Firestore:

  - Credentials and password reset requests: `kumbuosCredentialStore/<FIREBASE_CREDENTIAL_STORE_ID or VITE_FIREBASE_CREDENTIAL_STORE_ID>`.
  - PMS operating data: `kumbuosPmsDataStore/<FIREBASE_PMS_STORE_ID or VITE_FIREBASE_PMS_STORE_ID>`.

  Do not commit `.env.local` or real API keys. Use Vercel Project Settings > Environment Variables.
  
