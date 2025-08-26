import { Plus, Edit, Trash2 } from 'lucide-react';

const powerCards = [
  {
    id: 'pc1',
    title: 'Potwór złości',
    description: 'Karta pomagająca identyfikować i radzić sobie z uczuciem złości.',
    imageUrl: 'https://placehold.co/600x400.png',
    aiHint: 'cartoon monster',
  },
  {
    id: 'pc2',
    title: 'Superbohater dzielenia się',
    description: 'Zachęca do dzielenia się z rówieśnikami w pozytywny sposób.',
    imageUrl: 'https://placehold.co/600x400.png',
    aiHint: 'cartoon superhero',
  },
  {
    id: 'pc3',
    title: 'Żółw cichego czasu',
    description: 'Przewodnik, kiedy warto zrobić sobie chwilę ciszy.',
    imageUrl: 'https://placehold.co/600x400.png',
    aiHint: 'cartoon turtle',
  },
  {
    id: 'pc4',
    title: 'Uszy do słuchania',
    description: 'Promuje umiejętności aktywnego słuchania.',
    imageUrl: 'https://placehold.co/600x400.png',
    aiHint: 'big ears',
  },
  {
    id: 'pc5',
    title: 'Przyjazny robot',
    description: 'Pomaga w powitaniach i przedstawianiu się.',
    imageUrl: 'https://placehold.co/600x400.png',
    aiHint: 'friendly robot',
  },
  {
    id: 'pc6',
    title: 'Dzielny lew',
    description: 'Karta na chwile, które wymagają odwagi.',
    imageUrl: 'https://placehold.co/600x400.png',
    aiHint: 'cartoon lion',
  },
];

export default function PowerCardsPage() {
  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Karty Mocy</h2>
          <p className="text-gray-500">
            Twórz, zarządzaj i przypisuj Karty Mocy.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus className="mr-2 h-4 w-4" /> Dodaj nową kartę
          </button>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {powerCards.map((card) => (
          <div key={card.id} className="flex flex-col overflow-hidden bg-white rounded-lg shadow hover:shadow-xl transition-shadow duration-300">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">{card.title}</h3>
              <p className="text-gray-500 text-sm">{card.description}</p>
            </div>
            <div className="flex-grow p-4 flex items-center justify-center">
              <img
                src={card.imageUrl}
                alt={card.title}
                width={300}
                height={200}
                className="rounded-md object-cover aspect-[3/2]"
                data-ai-hint={card.aiHint}
              />
            </div>
            <div className="flex justify-end gap-2 bg-gray-50 p-4 border-t">
              <button className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300">
                <Edit className="mr-2 h-4 w-4" /> Edytuj
              </button>
              <button className="inline-flex items-center px-3 py-1 text-sm bg-red-100 hover:bg-red-200 rounded-md border border-red-300 text-red-700">
                <Trash2 className="mr-2 h-4 w-4" /> Usuń
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
