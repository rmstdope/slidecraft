import { getAllComponents, getSourceProblems, getToolbarConfig } from '../components/slides/defineComponent'
import '../components/slides'
import { convertRegistryConfig, convertToolbarConfig } from './registry'
import { createLanguageService, type LanguageService } from './service'
import type { DynamicValues } from './types'

export * from './types'
export { createLanguageService } from './service'

/** A language service over the live component registry, for a vault (the active one by default). */
export function registryLanguageService(dynamicValues?: DynamicValues, vault?: string | null): LanguageService {
  return createLanguageService({
    components: getAllComponents(vault).map((c) => convertRegistryConfig(c.registry)),
    toolbar: (name) => convertToolbarConfig(getToolbarConfig(name, vault)),
    dynamicValues,
    unavailable: getSourceProblems(vault).filter((p) => !p.template).map(({ name, message }) => ({ name, message })),
  })
}
