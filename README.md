# L’état, c’est moi – anebo ne?
### Interaktivní vzdělávací simulace ochrany základních práv v Evropské unii

Webová vzdělávací simulace z prostředí fiktivní **Marenské republiky** (hlavní město Orvelin), ve které se hráč ujímá funkce předsedy vlády během čtyřletého mandátu a řeší střety vnitrostátních zákonodárných i exekutivních opatření s právem Evropské unie, Listinou základních práv EU, Evropskou úmluvou o lidských právech a judikaturou Soudního dvora EU.

---

## Struktura projektu

```text
.
├── index.html               # Hlavní HTML dokument aplikace (kořenový kontejner #app)
├── styles.css               # Vizuální styl pracovního rozhraní, archivu a tiskového posudku
├── README.md                # Dokumentace projektu
├── data/                    # Datová vrstva scénáře, úloh, pramenů a hodnocení
│   ├── chapters.json        # Úvodní briefing, technický tutoriál a osnova 6 kapitol
│   ├── questions.json       # Vzdělávací úlohy (E), námitky Komise (R), rozhodnutí (S) a nápravy (N)
│   ├── final.json           # Závěrečná obhajoba před SDEU (výběr argumentů ARG a podání POD)
│   ├── documents.json       # Sbírka právních pramenů, rozsudků a spisů vládního archivu
│   ├── institutions.json    # Přehled institucí EU, Rady Evropy a Marenie + SVG schémata
│   ├── scoring.json         # Váhy 8 právních kompetencí (C1–C8), chybové štítky (M1–M11) a stupnice
│   └── assessment.json      # Slovní šablony pro generování závěrečného akademického posudku
├── js/                      # Aplikační logika (čisté ES moduly bez externích knihoven)
│   ├── storage.js           # Perzistence stavu kampaně v prohlížeči (LocalStorage)
│   ├── scoring.js           # Bodovací matematika, normalizace kompetencí a penalizace opakovaných chyb
│   ├── assessment.js        # Sestavení individualizovaného akademického posudku
│   ├── game-engine.js       # Hlavní stavový automat kampaně a odemykání dokumentů/institucí
│   ├── audio.js             # Procedurální zvuková odezva přes Web Audio API
│   ├── documents.js         # Čtečka jednotlivých dokumentů a modální okno institucionálních map
│   ├── archive.js           # Boční pracovní panel vládního archivu (filtry, vyhledávání, záložky)
│   ├── editor.js            # Editor obhajoby před SDEU v Kapitole 6 (kroky ARG a POD)
│   ├── reports.js           # Vykreslení závěrečného posudku a export do Markdownu / PDF
│   └── app.js               # Vstupní bod aplikace a orchestrátor uživatelského rozhraní
└── tests/
    └── simulate.mjs         # Automatizované testy integrity JSON dat a průchodů kampaní (Node.js)
