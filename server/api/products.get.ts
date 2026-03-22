import { getProducts } from '../utils/db'

export default defineEventHandler(async (event) => {
  const products = await getProducts()
  return products
})
