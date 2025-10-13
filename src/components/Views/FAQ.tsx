import React, { useState } from 'react';

type QA = {
  q: string;
  a: React.ReactNode;
};

const faqs: QA[] = [
  {
    q: 'Jak zalogować się do systemu?',
    a: (
      <>
        Użyj adresu e‑mail oraz hasła otrzymanych od administratora. Jeśli nie pamiętasz hasła, skorzystaj z opcji „Nie pamiętam hasła” na ekranie logowania.
      </>
    ),
  },
  {
    q: 'Nie pamiętam hasła — co zrobić?',
    a: (
      <>
        Na ekranie logowania wybierz „Resetuj hasło”. Otrzymasz wiadomość e‑mail z instrukcjami. Jeśli e‑mail nie dotarł, sprawdź SPAM lub skontaktuj się z administratorem.
      </>
    ),
  },
  {
    q: 'Jakie role istnieją w systemie i czym się różnią?',
    a: (
      <>
        Wyróżniamy role: Administrator (pełne uprawnienia), Koordynator/Kontakt (zarządzanie danymi operacyjnymi), Pracownik (podgląd kalendarza i podstawowe akcje). Dostęp do widoków i akcji zależy od roli.
      </>
    ),
  },
  {
    q: 'Jak dodać spotkanie do kalendarza pracownika?',
    a: (
      <>
        Wejdź w „Pracownicy Fundacji → Grafiki”, wybierz dzień i godzinę, a następnie uzupełnij formularz spotkania (nazwa, specjalista, podopieczny, sala). Zapisz, aby utworzyć wydarzenie.
      </>
    ),
  },
  {
    q: 'Jak zarezerwować salę?',
    a: (
      <>
        Przejdź do „Rezerwacje sal → Grafiki”, kliknij w wybrany slot czasu i wypełnij formularz. Spotkanie zostanie przypisane do wskazanej sali.
      </>
    ),
  },
  {
    q: 'Czy mogę edytować lub przenosić spotkania?',
    a: (
      <>
        Tak. Kliknij na istniejące wydarzenie, aby je edytować, lub przeciągnij w kalendarzu na inny termin. Uprawnienia do edycji zależą od roli użytkownika.
      </>
    ),
  },
  {
    q: 'Jak oznaczyć status spotkania (np. odwołane, w toku)?',
    a: (
      <>
        Otwórz szczegóły wydarzenia i wybierz odpowiedni status. Statusy mogą być synchronizowane z backendem i są widoczne dla całego zespołu.
      </>
    ),
  },
  {
    q: 'Jak dodać lub zaktualizować pracownika?',
    a: (
      <>
        W „Pracownicy Fundacji → Zarządzaj pracownikami” administrator i koordynator mogą dodawać, edytować i dezaktywować konta. Pracownicy nie mają dostępu do tego widoku.
      </>
    ),
  },
  {
    q: 'Gdzie znajdę listę podopiecznych?',
    a: (
      <>
        Wejdź w sekcję „Podopieczni”. Wyszukuj po imieniu i nazwisku oraz podglądaj historię spotkań według uprawnień Twojej roli.
      </>
    ),
  },
  {
    q: 'Czym są Zadania i jak z nich korzystać?',
    a: (
      <>
        W module „Zadania” możesz tworzyć i przypisywać zadania do siebie lub zespołu, śledzić status oraz terminy. Dostępność funkcji zależy od roli.
      </>
    ),
  },
  {
    q: 'Czy aplikacja działa na telefonie?',
    a: (
      <>
        Tak. System posiada dedykowany widok mobilny. Po zalogowaniu na telefonie nastąpi automatyczne przekierowanie do uproszczonego interfejsu.
      </>
    ),
  },
  {
    q: 'Nie widzę części danych — dlaczego?',
    a: (
      <>
        Najczęstszą przyczyną są ograniczenia uprawnień. Jeśli uważasz, że to błąd, skontaktuj się z administratorem, podając swój e‑mail i opis problemu.
      </>
    ),
  },
  {
    q: 'Czy godziny uwzględniają strefę czasową?',
    a: (
      <>
        System zapisuje czas w formacie lokalnym według ustawień serwera. Jeśli zauważysz rozbieżności, upewnij się, że strefa czasowa urządzenia jest poprawna.
      </>
    ),
  },
  {
    q: 'Jak zapobiec utracie niezapisanych zmian?',
    a: (
      <>
        Wbudowany strażnik zmian informuje o niezapisanych danych przy próbie wyjścia. Zawsze klikaj „Zapisz” w formularzach przed zmianą widoku.
      </>
    ),
  },
  {
    q: 'Jak zgłosić problem lub sugestię?',
    a: (
      <>
        Opisz problem (kroki, zrzuty ekranu, data/godzina) i wyślij do administratora systemu. Jeśli masz uprawnienia, część ustawień znajdziesz w zakładce „Ustawienia”.
      </>
    ),
  },
];

function AccordionItem({ item, isOpen, onToggle }: { item: QA; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-gray-900">{item.q}</span>
        <span className="ml-4 text-gray-400">{isOpen ? '−' : '+'}</span>
      </button>
      <div
        className={`px-4 transition-all duration-200 ease-in-out overflow-hidden ${isOpen ? 'max-h-96 py-2' : 'max-h-0 py-0'}`}
      >
        <div className="text-gray-700 text-sm leading-relaxed pb-3">{item.a}</div>
      </div>
    </div>
  );
}

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">FAQ i pomoc</h1>
      <p className="text-gray-500 mb-4">Najczęściej zadawane pytania dotyczące systemu zarządzania grafikiem i rezerwacjami.</p>

      <div className="mb-6 p-4 sm:p-5 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-900">
        <div className="flex items-start gap-3">
          <div className="text-2xl leading-none">⚠️</div>
          <div>
            <div className="text-lg font-bold">To tylko przykład — treści do ustalenia</div>
            <p className="mt-1 text-sm sm:text-base">
              Poniższe pytania i odpowiedzi są poglądowe (tzw. „z czapy”) i służą do pokazania wyglądu sekcji FAQ. Proszę o przekazanie docelowych pytań oraz odpowiedzi — podmienimy je tutaj.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {faqs.map((item, idx) => (
          <AccordionItem
            key={idx}
            item={item}
            isOpen={openIndex === idx}
            onToggle={() => setOpenIndex(openIndex === idx ? null : idx)}
          />
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-900">
        Szukasz instruktażu wideo? Napisz, jakie tematy chcesz zobaczyć w materiałach — dodamy je do tej sekcji.
      </div>
    </div>
  );
};

export default FAQ;
