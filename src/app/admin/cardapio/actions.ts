'use server'

import { revalidatePath } from 'next/cache'

export async function revalidateCardapio() {
  revalidatePath('/(cliente)/cardapio')
  revalidatePath('/cardapio')
}
