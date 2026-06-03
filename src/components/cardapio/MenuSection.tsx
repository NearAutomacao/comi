import type { MenuCategory, MenuItem } from '@/types'
import ItemCard from './ItemCard'

interface Props {
  category: MenuCategory
  items: MenuItem[]
}

export default function MenuSection({ category, items }: Props) {
  return (
    <section id={category.slug} className="scroll-mt-36">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className="w-1 h-6 bg-orange-500 rounded-full inline-block" />
        {category.name}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map(item => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}
