// Mapowanie id karty na numer pliku
const imageMap: Record<string, string> = {
  potworzlosci: '1.png',
  sharinghero: '2.png',
  slowtimeturtle: '3.png',
  listeningears: '4.png',
  friendlyrobot: '5.png',
  bravelion: '6.png',
};
import { Plus, Edit, Trash2 } from 'lucide-react';

import { useState } from 'react';

const PLACEHOLDER_IMAGE = 'placeholder.png';

type PowerCard = {
  id: string;
  title: string;
  description: string;
  aiHint: string;
  image?: string;
};

const initialCards: PowerCard[] = [
  {
    id: 'potworzlosci',
    title: 'Potwór złości',
    description: 'Karta pomagająca identyfikować i radzić sobie z uczuciem złości.',
    aiHint: 'cartoon monster',
    image: '1.png',
  },
  {
    id: 'sharinghero',
    title: 'Superbohater dzielenia się',
    description: 'Zachęca do dzielenia się z rówieśnikami w pozytywny sposób.',
    aiHint: 'cartoon superhero',
    image: '2.png',
  },
  {
    id: 'slowtimeturtle',
    title: 'Żółw cichego czasu',
    description: 'Przewodnik, kiedy warto zrobić sobie chwilę ciszy.',
    aiHint: 'cartoon turtle',
    image: '3.png',
  },
  {
    id: 'listeningears',
    title: 'Uszy do słuchania',
    description: 'Promuje umiejętności aktywnego słuchania.',
    aiHint: 'big ears',
    image: '4.png',
  },
  {
    id: 'friendlyrobot',
    title: 'Przyjazny robot',
    description: 'Pomaga w powitaniach i przedstawianiu się.',
    aiHint: 'friendly robot',
    image: '5.png',
  },
  {
    id: 'bravelion',
    title: 'Dzielny lew',
    description: 'Karta na chwile, które wymagają odwagi.',
    aiHint: 'cartoon lion',
    image: '6.png',
  },
];

export default function PowerCardsPage() {
  const handleDeleteCard = (id: string) => {
    if (window.confirm('Czy na pewno chcesz usunąć tę kartę mocy?')) {
      setCards(cards.filter(card => card.id !== id));
    }
  };
  const [cards, setCards] = useState(initialCards);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCard, setNewCard] = useState({
    id: '',
    title: '',
    description: '',
    aiHint: '',
  });

  const handleOpenAddModal = () => {
    setNewCard({ id: '', title: '', description: '', aiHint: '' });
    setShowAddModal(true);
  };
  const handleCloseAddModal = () => setShowAddModal(false);

  const handleChangeNewCard = (field: keyof typeof newCard, value: string) => {
    setNewCard((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveNewCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCard.title.trim() || !newCard.description.trim()) return;
    const nextId = `custom${Date.now()}`;
    setCards([
      ...cards,
      {
        ...newCard,
        id: nextId,
        image: PLACEHOLDER_IMAGE,
      },
    ]);
    setShowAddModal(false);
  };

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Karty Mocy</h2>
          <p className="text-gray-500">Twórz, zarządzaj i przypisuj Karty Mocy.</p>
        </div>
        <div className="flex items-center space-x-2">
          <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" onClick={handleOpenAddModal}>
            <Plus className="mr-2 h-4 w-4" /> Dodaj nową kartę
          </button>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
  {cards.map((card) => (
          <div key={card.id} className="flex flex-col overflow-hidden bg-white rounded-lg shadow hover:shadow-xl transition-shadow duration-300">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">{card.title}</h3>
              <p className="text-gray-500 text-sm">{card.description}</p>
            </div>
            <div className="flex-grow p-4 flex items-center justify-center">
              <img
                src={card.image ? `/assets/powercards/${card.image}` : `/assets/powercards/${imageMap[card.id]}`}
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
              <button
                className="inline-flex items-center px-3 py-1 text-sm bg-red-100 hover:bg-red-200 rounded-md border border-red-300 text-red-700"
                onClick={() => handleDeleteCard(card.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Usuń
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal dodawania nowej karty */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <form className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md" onSubmit={handleSaveNewCard}>
            <h3 className="text-lg font-semibold mb-2">Dodaj nową kartę mocy</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Tytuł</label>
              <input type="text" className="w-full border px-3 py-2 rounded" value={newCard.title} onChange={e => handleChangeNewCard('title', e.target.value)} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Opis</label>
              <input type="text" className="w-full border px-3 py-2 rounded" value={newCard.description} onChange={e => handleChangeNewCard('description', e.target.value)} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">AI Hint (opcjonalnie)</label>
              <input type="text" className="w-full border px-3 py-2 rounded" value={newCard.aiHint} onChange={e => handleChangeNewCard('aiHint', e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="px-4 py-2 rounded border text-sm bg-gray-50 hover:bg-gray-100" onClick={handleCloseAddModal}>Anuluj</button>
              <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Dodaj kartę</button>
            </div>
            <div className="mt-4 text-xs text-gray-400">Obraz zostanie ustawiony jako placeholder. Dodawanie własnych obrazów będzie możliwe w przyszłości.</div>
          </form>
        </div>
      )}
    </div>
  );
}
