import type { MDXComponents } from 'mdx/types'
import { getMdxScope } from './components/mdxScope'

/** Provider merge used by @mdx-js/react (providerImportSource). */
export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...(getMdxScope() as MDXComponents), ...components }
}
