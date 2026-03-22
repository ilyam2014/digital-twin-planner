import { addProduct } from '../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const product = await addProduct(body)
  return product
})
