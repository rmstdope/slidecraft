/**
 * Fixed development ports (Part 4 §2). These are constants on purpose: they are never read
 * from the environment, so the API server, the Vite proxy, the CORS origin and the URL the
 * user opens always agree, even when a launcher injects ambient PORT-style variables.
 * The standalone binary chooses its listen port separately (--port / PORT).
 */
export const DEFAULT_API_PORT = 6110
export const DEFAULT_CLIENT_PORT = 6100

export const CLIENT_PORT = DEFAULT_CLIENT_PORT
export const API_PORT = DEFAULT_API_PORT

export const API_URL = `http://localhost:${API_PORT}`
export const CLIENT_URL = `http://localhost:${CLIENT_PORT}`
