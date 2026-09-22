import { catalog } from '../data/catalog'
import type { Catalog } from '../types'

export async function getCatalog(): Promise<Catalog> {
  await new Promise(resolve => setTimeout(resolve, 250))
  return structuredClone(catalog)
}
