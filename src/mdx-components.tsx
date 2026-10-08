import type { MDXComponents } from 'mdx/types'
import { mdxComponentScope } from './components/mdxScope'

/** Provider merge used by @mdx-js/react (providerImportSource). */
export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...(mdxComponentScope as MDXComponents), ...components }
}
