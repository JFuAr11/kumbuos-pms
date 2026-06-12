
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

  Do not commit `.env.local` or real API keys. Use Vercel Project Settings > Environment Variables.
  
