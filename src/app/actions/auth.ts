'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { validateCPF } from '@/lib/utils'

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  const cpf = (formData.get('cpf') as string).replace(/\D/g, '')
  const isManager = formData.get('role') === 'manager'

  if (!validateCPF(cpf)) return { error: 'CPF inválido' }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone, cpf, role: isManager ? 'manager' : 'customer', app: 'comi' },
    },
  })

  if (error) return { error: error.message }
  if (!data.user) return { error: 'Erro ao criar conta' }

  // Para gerentes: criar o restaurante automaticamente
  if (isManager) {
    const admin = await createAdminClient()

    // Garante que o profile foi criado pelo trigger
    await new Promise(r => setTimeout(r, 500))

    const { data: restaurant } = await admin
      .from('restaurants')
      .insert({
        owner_id: data.user.id,
        name: `Restaurante de ${name.split(' ')[0]}`,
        slug: `restaurante-${data.user.id.slice(0, 8)}`,
      })
      .select()
      .single()

    if (restaurant) {
      // Liga o profile ao restaurante
      await admin
        .from('profiles')
        .update({ restaurant_id: restaurant.id })
        .eq('id', data.user.id)

      // Cria horários padrão para o restaurante
      const days = [0, 1, 2, 3, 4, 5, 6]
      await admin.from('working_hours').insert(
        days.map(d => ({
          restaurant_id: restaurant.id,
          day_of_week: d,
          open_time: '11:00',
          close_time: '23:00',
          is_open: true,
        }))
      )

      // Cria categorias padrão
      await admin.from('menu_categories').insert([
        { restaurant_id: restaurant.id, name: 'Porções',    slug: `porcoes-${restaurant.id.slice(0,6)}`,    display_order: 1 },
        { restaurant_id: restaurant.id, name: 'Lanches',    slug: `lanches-${restaurant.id.slice(0,6)}`,    display_order: 2 },
        { restaurant_id: restaurant.id, name: 'Bebidas',    slug: `bebidas-${restaurant.id.slice(0,6)}`,    display_order: 3 },
        { restaurant_id: restaurant.id, name: 'Sobremesas', slug: `sobremesas-${restaurant.id.slice(0,6)}`, display_order: 4 },
      ])
    }

    redirect('/admin/dashboard')
  }

  redirect('/cardapio')
}

export async function signUpManager(formData: FormData) {
  const form = new FormData()
  form.set('email', formData.get('email') as string)
  form.set('password', formData.get('password') as string)
  form.set('name', formData.get('name') as string)
  form.set('phone', formData.get('phone') as string)
  form.set('cpf', formData.get('cpf') as string)
  form.set('role', 'manager')
  return signUp(form)
}

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: 'Email ou senha incorretos' }

  // Usa admin client para buscar o perfil — bypassa RLS e problemas de schema exposto
  const admin = await createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  console.log('[signIn] profile:', profile, 'error:', profileError)

  if (profile?.role === 'manager') redirect('/admin/dashboard')
  redirect('/cardapio')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
