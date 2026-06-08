'use server'

import PocketBase from 'pocketbase'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { validateCPF } from '@/lib/utils'
import { createAdminSessionToken } from '@/lib/auth-session'

const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090'

function pb() {
  const client = new PocketBase(PB_URL)
  client.autoCancellation(false)
  return client
}

export async function signUp(formData: FormData) {
  let redirectTo: string | null = null

  try {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const name = formData.get('name') as string
    const phone = formData.get('phone') as string
    const cpf = ((formData.get('cpf') ?? '') as string).replace(/\D/g, '')
    const isManager = formData.get('role') === 'manager'
    const next = formData.get('next') as string | null

    if (!validateCPF(cpf)) return { error: 'CPF inválido' }

    const client = pb()

    // Cria usuário no PocketBase
    const user = await client.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      name,
      phone,
      cpf,
      role: isManager ? 'manager' : 'customer',
    })

    // Autentica para que operações subsequentes respeitem as rules
    await client.collection('users').authWithPassword(email, password)

    if (isManager) {
      // Cria restaurante para o gerente
      const restaurant = await client.collection('restaurants').create({
        owner_id: user.id,
        name: `Restaurante de ${name.split(' ')[0]}`,
        slug: `restaurante-${user.id.slice(0, 8)}`,
      })

      // Atualiza o usuário com o restaurant_id
      await client.collection('users').update(user.id, { restaurant_id: restaurant.id })

      // Cria horários padrão
      const days = [0, 1, 2, 3, 4, 5, 6]
      for (const d of days) {
        await client.collection('working_hours').create({
          restaurant_id: restaurant.id,
          day_of_week: d,
          open_time: '11:00',
          close_time: '23:00',
          is_open: true,
        })
      }

      // Cria categorias padrão
      const defaultCategories = [
        { name: 'Porções', slug: `porcoes-${restaurant.id.slice(0, 6)}`, display_order: 1 },
        { name: 'Lanches', slug: `lanches-${restaurant.id.slice(0, 6)}`, display_order: 2 },
        { name: 'Bebidas', slug: `bebidas-${restaurant.id.slice(0, 6)}`, display_order: 3 },
        { name: 'Sobremesas', slug: `sobremesas-${restaurant.id.slice(0, 6)}`, display_order: 4 },
      ]
      for (const cat of defaultCategories) {
        await client.collection('menu_categories').create({ restaurant_id: restaurant.id, ...cat })
      }

      // Cria subscription de trial
      const now = new Date()
      const expires = new Date()
      expires.setDate(expires.getDate() + 30)
      await client.collection('subscriptions').create({
        restaurant_id: restaurant.id,
        plan: 'trial',
        status: 'trial',
        starts_at: now.toISOString(),
        expires_at: expires.toISOString(),
      })

      // Cria sessão JWT para o admin
      const token = await createAdminSessionToken({
        userId: user.id,
        email: user.email,
        name,
        role: 'manager',
        restaurantId: restaurant.id,
      })

      const cookieStore = await cookies()
      cookieStore.set('comi_admin_session', token, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        httpOnly: true,
        sameSite: 'lax',
      })

      redirectTo = '/admin/dashboard'
    } else {
      redirectTo = next ?? '/cardapio'
    }
  } catch (err: any) {
    console.error('[signUp] erro:', JSON.stringify(err?.data ?? err?.message ?? err))
    const fieldErrors = err?.data?.data
    if (fieldErrors) {
      const detail = Object.entries(fieldErrors)
        .map(([k, v]: any) => `${k}: ${v?.message ?? v}`)
        .join(', ')
      return { error: detail || err?.data?.message || 'Erro ao criar conta' }
    }
    const msg = err?.data?.message ?? err?.message ?? 'Erro ao criar conta'
    return { error: msg }
  }

  return { redirectTo }
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

  const client = pb()

  try {
    const auth = await client.collection('users').authWithPassword(email, password)
    const user = auth.record as any

    if (!user) return { error: 'Conta não encontrada' }

    const role = user.role as 'manager' | 'customer'
    const restaurantId = user.restaurant_id ?? null

    if (role !== 'manager') {
      return { error: 'Esta conta não tem acesso ao painel administrativo.' }
    }

    const token = await createAdminSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name ?? email,
      role,
      restaurantId,
    })

    const cookieStore = await cookies()
    cookieStore.set('comi_admin_session', token, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: 'lax',
    })

    return { role }
  } catch (err: any) {
    const msg = err?.data?.message ?? err?.message ?? 'Email ou senha incorretos'
    return { error: msg }
  }
}

export async function signOut() {
  const cookieStore = await cookies()
  cookieStore.delete('comi_admin_session')
  redirect('/')
}
