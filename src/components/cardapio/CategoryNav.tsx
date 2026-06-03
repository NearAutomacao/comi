'use client'

import { useEffect, useState } from 'react'
import type { MenuCategory } from '@/types'

interface Props {
  categories: MenuCategory[]
}

export default function CategoryNav({ categories }: Props) {
  const [active, setActive] = useState(categories[0]?.slug ?? '')

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
          }
        })
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )

    categories.forEach(cat => {
      const el = document.getElementById(cat.slug)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [categories])

  function scrollTo(slug: string) {
    const el = document.getElementById(slug)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 120
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <nav className="sticky top-[105px] md:top-[65px] z-40 bg-white/95 backdrop-blur shadow-sm rounded-xl px-2 py-2 flex gap-1 overflow-x-auto scrollbar-hide">
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => scrollTo(cat.slug)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            active === cat.slug
              ? 'bg-orange-500 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </nav>
  )
}
