'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { validateCPF } from '@/lib/utils'

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  const cpf = (formData.get('cpf') as string).replace(/\D/g, '')

  if (!validateCPF(cpf)) {
    return { error: 'CPF inválido' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone, cpf, role: 'customer' },
    },
  })

  if (error) return { error: error.message }

  redirect('/cardapio')
}

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: 'Email ou senha incorretos' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (profile?.role === 'manager') redirect('/admin/dashboard')
  else redirect('/cardapio')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
