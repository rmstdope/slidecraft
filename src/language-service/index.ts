import { getAllComponents, getToolbarConfig } from '../components/slides/defineComponent'
import '../components/slides'
import { convertRegistryConfig, convertToolbarConfig } from './registry'
import { createLanguageService, type LanguageService } from './service'
import type { DynamicValues } from './types'

export * from './types'
export { createLanguageService } from './service'

/** A language service over the live component registry. */
export function registryLanguageService(dynamicValues?: DynamicValues): LanguageService {
  return createLanguageService({
    components: getAllComponents().map((c) => convertRegistryConfig(c.registry)),
    toolbar: (name) => convertToolbarConfig(getToolbarConfig(name)),
    dynamicValues,
  })
}
