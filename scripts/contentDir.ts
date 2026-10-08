/** Print the content directory the server would use (same flag, env and config resolution). */
import { getContentDir } from '../server/lib/contentSources.ts'

console.log(getContentDir())
