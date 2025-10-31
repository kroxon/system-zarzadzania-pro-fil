import React, { useState } from 'react';

type QA = {
  q: string;
  a: React.ReactNode;
};

type FAQSection = {
  title: string;
  items: QA[];
};

const sections: FAQSection[] = [
  {
    title: 'Role i uprawnienia',
    items: [
      {
        q: 'Jakie role istnieją w systemie i czym się różnią?',
        a: (
          <>
            W systemie istnieją trzy główne role:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <b>Administrator:</b> Ma pełne uprawnienia. Zarządza użytkownikami (akceptuje rejestracje), ustala godziny dostępności, zarządza salami, specjalizacjami, podopiecznymi oraz ma pełny dostęp do wszystkich spotkań, zadań i statystyk.
              </li>
              <li>
                <b>Pierwszy Kontakt:</b> Może zarządzać swoimi spotkaniami, zadaniami i podopiecznymi. Widzi własne statystyki. W odróżnieniu od Pracownika, może tworzyć spotkania dla innych, nie biorąc w nich udziału.
              </li>
              <li>
                <b>Pracownik:</b> Może zarządzać wyłącznie własnymi spotkaniami, zadaniami i przypisanymi podopiecznymi. Widzi tylko własne statystyki.
              </li>
            </ul>
          </>
        ),
      },
      {
        q: 'Nie widzę niektórych modułów (np. "Zarządzaj pracownikami"). Dlaczego?',
        a: (
          <>
            Dostęp do poszczególnych sekcji aplikacji jest zależny od Twojej roli. Pełne panele zarządzania (użytkownikami, salami, ustawieniami) są widoczne tylko dla Administratora. Role Pracownik i Pierwszy Kontakt widzą moduły niezbędne do ich codziennej pracy.
          </>
        ),
      },
    ],
  },
  {
    title: 'Zarządzanie grafikiem i spotkaniami',
    items: [
      {
        q: 'Kto może tworzyć i planować spotkania?',
        a: (
          <>
            Zasady tworzenia spotkań zależą od roli:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <b>Administrator:</b> Może tworzyć dowolne spotkania, nawet "puste" (np. rezerwacja sali bez przypisanego pracownika).
              </li>
              <li>
                <b>Pierwszy Kontakt:</b> Może tworzyć spotkania dla dowolnych pracowników i podopiecznych, nawet jeśli sam nie bierze w nich udziału.
              </li>
              <li>
                <b>Pracownik:</b> Może tworzyć spotkania, ale musi być do nich przypisany przynajmniej on sam.
              </li>
            </ul>
          </>
        ),
      },
      {
        q: 'Jak edytować lub usunąć spotkanie?',
        a: (
          <>
            <p className="mb-2">
              Zasady edycji zależą od tego, czy spotkanie już się odbyło:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <b>Spotkania przyszłe:</b> Mogą być dowolnie edytowane przez wszystkich uczestników oraz Administratora i Pierwszy Kontakt.
              </li>
              <li>
                <b>Spotkania przeszłe:</b> Pracownik i Pierwszy Kontakt mogą edytować w nich tylko status oraz dodawać notatki. Pełną edycję (np. zmianę daty) ma tylko Administrator.
              </li>
              <li>
                <b>Usuwanie:</b> Pracownik nie może usunąć spotkania, jeśli przypisany jest do niego więcej niż jeden pracownik. W takim przypadku należy skontaktować się z Administratorem.
              </li>
            </ul>
          </>
        ),
      },
      {
        q: 'Dlaczego nie mogę zapisać spotkania? (Konflikty)',
        a: (
          <>
            System aktywnie zapobiega konfliktom. Spotkanie nie zostanie zapisane, jeśli:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Wybrany pracownik lub podopieczny ma już inne spotkanie w tym czasie.</li>
              <li>Sala jest już zajęta.</li>
              <li>Pracownik nie ma ustawionych "godzin dostępności" na ten termin.</li>
            </ul>
            <p className="mt-2">
              W przypadku konfliktu system wyświetli odpowiedni komunikat.
            </p>
          </>
        ),
      },
      {
        q: 'Jak ustawić lub zmienić moje godziny dostępności?',
        a: (
          <>
            Godziny dostępności (czyli ramowy czas pracy, w którym można Cię rezerwować) są ustalane centralnie. Tylko Administrator może dodawać i edytować godziny dostępności pracowników. Skontaktuj się z nim, aby ustalić lub zaktualizować swój grafik.
          </>
        ),
      },
    ],
  },
  {
    title: 'Detale i statusy spotkań',
    items: [
      {
        q: 'Jakie są statusy spotkań i jak działają?',
        a: (
          <>
            Każde nowe spotkanie automatycznie otrzymuje status <b>"Zaplanowany"</b>. Gdy nadejdzie jego czas, system sam zmieni status na <b>"W trakcie"</b>, a po zakończeniu na <b>"Ukończone"</b>.
            <br />
            Dodatkowo, możesz ręcznie zmienić status na <b>"Anulowane"</b> (jeśli spotkanie jest odwołane) lub <b>"Nieobecny (pacjent)"</b>.
          </>
        ),
      },
      {
        q: 'Czy do spotkania można dodawać notatki?',
        a: (
          <>
            Tak. W formularzu tworzenia lub edycji spotkania znajduje się pole na dowolne notatki. Można je dodawać zarówno do spotkań przyszłych, jak i przeszłych (historycznych).
          </>
        ),
      },
    ],
  },
  {
    title: 'Podopieczni',
    items: [
      {
        q: 'Kto zarządza listą podopiecznych?',
        a: (
          <>
            Podopiecznych do systemu dodaje, edytuje i usuwa wyłącznie <b>Administrator</b>. On również odpowiada za przypisanie podopiecznego do konkretnego pracownika.
          </>
        ),
      },
      {
        q: 'Co mogę zobaczyć w module "Podopieczni"?',
        a: (
          <>
            Jako Pracownik lub Pierwszy Kontakt, widzisz listę wszystkich podopiecznych. Szczegółowe informacje widzisz <b>tylko tych podopiecznych, którzy są do Ciebie przypisani</b>. Możesz przeglądać ich dane oraz edytować dodatkowe parametry, ale nie możesz ich usunąć czy zmienić przypisanych pracowników.
          </>
        ),
      },
    ],
  },
  {
    title: 'Zadania i statystyki',
    items: [
      {
        q: 'Jak działają "Zadania"?',
        a: (
          <>
            Moduł Zadań służy do organizacji pracy. <b>Administrator</b> tworzy zadania, przydziela je pracownikom i jako jedyny może je usuwać.
            <br />
            Pracownicy i Pierwszy Kontakt mogą przeglądać przypisane do nich zadania oraz oznaczać je jako <b>wykonane</b>.
          </>
        ),
      },
      {
        q: 'Kto ma dostęp do statystyk?',
        a: (
          <>
            Uprawnienia do statystyk zależą od roli. <b>Administrator</b> widzi pełne statystyki i raporty z całego systemu. <b>Pracownik</b> oraz <b>Pierwszy Kontakt</b> mają dostęp wyłącznie do statystyk dotyczących ich własnej pracy.
          </>
        ),
      },
    ],
  },
  {
    title: 'Wsparcie techniczne',
    items: [
      {
        q: 'Czy aplikacja działa na telefonie?',
        a: (
          <>
            Tak. System posiada dedykowany widok mobilny. Po zalogowaniu na telefonie lub tablecie nastąpi automatyczne przekierowanie do uproszczonego interfejsu, dostosowanego do mniejszych ekranów.
          </>
        ),
      },
      {
        q: 'Jak zgłosić problem lub sugestię?',
        a: (
          <>
            Opisz problem (podaj kroki, które do niego doprowadziły, zrób zrzut ekranu, podaj datę/godzinę) i wyślij zgłoszenie do administratora systemu.
          </>
        ),
      },
    ],
  },
];

function AccordionItem({ item, isOpen, onToggle }: { item: QA; isOpen: boolean; onToggle: () => void }) {
  return (
    <div
      className={`rounded-2xl border transition-all duration-200 shadow-sm ${
        isOpen
          ? 'border-blue-300 bg-white/95 shadow-md'
          : 'border-slate-100 bg-white/70 backdrop-blur hover:-translate-y-[1px] hover:shadow-md'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-start justify-between gap-4 rounded-2xl px-5 py-4 text-left transition ${
          isOpen ? 'text-slate-900' : 'text-slate-800 hover:text-slate-900'
        }`}
        aria-expanded={isOpen}
      >
        <span className="text-base font-semibold leading-snug">{item.q}</span>
        <span
          className={`ml-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold transition ${
            isOpen ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {isOpen ? '−' : '+'}
        </span>
      </button>
      <div
        className={`px-5 transition-[max-height,padding] duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-[520px] pb-5' : 'max-h-0 pb-0'
        }`}
      >
        <div className="text-sm leading-relaxed text-slate-600">{item.a}</div>
      </div>
    </div>
  );
}

const CentrumPomocy: React.FC = () => {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto px-4 pb-16 sm:px-6">
      <div className="space-y-10">
        {sections.map((section, sectionIdx) => (
          <section
            key={section.title}
            className="rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-sm ring-1 ring-black/5 backdrop-blur-sm sm:p-8"
          >
            <header className="mb-5 flex items-center gap-3">
              <span className="h-10 w-1 rounded-full bg-blue-500" />
              <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
            </header>
            <div className="space-y-4">
              {section.items.map((item, itemIdx) => {
                const itemKey = `${sectionIdx}-${itemIdx}`;

                return (
                  <AccordionItem
                    key={itemKey}
                    item={item}
                    isOpen={openKey === itemKey}
                    onToggle={() => setOpenKey(openKey === itemKey ? null : itemKey)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <aside className="mt-12 flex items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50/80 p-6 text-sm text-blue-900 shadow-sm">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-600">?</div>
        <div>
          <p className="text-base font-semibold">Nie znalazłeś odpowiedzi?</p>
          <p className="mt-1 text-sm text-blue-800">
            Jeśli potrzebujesz dodatkowego wsparcia, skontaktuj się z administratorem systemu w uzgodniony sposób.
          </p>
        </div>
      </aside>
    </div>
  );
};

export default CentrumPomocy;
