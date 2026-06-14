
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
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: optional, recommended for a private Google Sheet.
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: optional, recommended for a private Google Sheet. Keep the `\n` line breaks escaped in Vercel.

  FX rates are read from columns `Date`, `TZS_per_USD`, and `USD_per_TZS`. For private sheets, share the Google Sheet with the service account email as Viewer.

  Do not commit `.env.local` or real API keys. Use Vercel Project Settings > Environment Variables.
  
