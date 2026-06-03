import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i)
  let check = 11 - (sum % 11)
  if (check >= 10) check = 0
  if (check !== parseInt(clean[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i)
  check = 11 - (sum % 11)
  if (check >= 10) check = 0
  return check === parseInt(clean[10])
}

export function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.length === 11) {
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
}

export function getDayName(day: number): string {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  return days[day] ?? ''
}

export function isRestaurantOpen(
  workingHours: { day_of_week: number; open_time: string | null; close_time: string | null; is_open: boolean }[],
  closedDates: { date: string }[],
  now = new Date()
): { open: boolean; reason?: string } {
  const todayStr = now.toISOString().split('T')[0]
  const isClosed = closedDates.some((d) => d.date === todayStr)
  if (isClosed) return { open: false, reason: 'fechado hoje' }

  const dayOfWeek = now.getDay()
  const hours = workingHours.find((h) => h.day_of_week === dayOfWeek)
  if (!hours || !hours.is_open || !hours.open_time || !hours.close_time) {
    return { open: false, reason: 'fechado hoje' }
  }

  const [openH, openM] = hours.open_time.split(':').map(Number)
  const [closeH, closeM] = hours.close_time.split(':').map(Number)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  if (currentMinutes < openMinutes || currentMinutes >= closeMinutes) {
    return { open: false, reason: `abre às ${hours.open_time.slice(0, 5)}` }
  }
  return { open: true }
}
