/**
 * Files embedded into the release binary (Phase 11 fills this during `build:release` and restores
 * it afterwards). Tracked in git as the empty map: never commit the generated form.
 */
export const embedded: Record<string, string> = {}
