---
name: project-werkstromen
description: Splits een groot project op in parallelle werkstromen/threads met een eigenaar, eigen bestanden en een duidelijke "klaar als"-regel, zodat threads elkaar niet overschrijven. Gebruik deze skill wanneer de gebruiker werk wil verdelen, parallel wil laten uitvoeren, subagents/threads/branches wil plannen, "hoe splits ik dit op" vraagt, of wanneer een opdracht zo groot is dat één sessie hem sequentieel zou afwerken. Ook gebruiken na project-kickoff.
---

# Werkstromen plannen

Parallel werken wint alleen tijd als de stukken echt onafhankelijk zijn. Threads die dezelfde bestanden aanraken veroorzaken merge-conflicten en overschrijven elkaars fixes. Plan daarom de grenzen vóór je start.

## Stappen
1. Lees `CLAUDE.md` en `docs/beslissingen.md` (of laat ze eerst maken met `project-kickoff`).
2. Breng in kaart welke bestanden/modules het werk raakt.
3. **Eerst de naden maken**: als alles in één groot bestand zit, doe eerst een aparte, sequentiële thread die het opsplitst zonder gedragsverandering. Pas daarna parallel.
4. Maak per werkstroom een korte kaart:
   - **Naam en doel** (één zin)
   - **Eigen bestanden/mappen**: andere threads blijven hier af
   - **Klaar als**: toetsbaar (test groen, scenario werkt)
   - **Afhankelijkheden**: wat moet eerst klaar zijn
   - **Mens beslist**: punten waarvoor de thread moet stoppen en vragen
5. Eén thread = één branch = één PR, zo klein mogelijk. Liever vijf kleine dan één grote.
6. Respecteer het budget uit de brief. Begin met 2-3 threads, niet 8.

## Overlapregel
Raken twee werkstromen onvermijdelijk hetzelfde bestand, voer ze dan na elkaar uit of laat één thread beide doen. Zeg dit expliciet tegen de gebruiker.

## Uitvoer
Presenteer het plan als tabel (werkstroom, bestanden, klaar-als, volgorde) en wacht op akkoord voordat je threads start. Geef elke thread bij de start mee: de kaart, het pad naar `CLAUDE.md` en de opdracht om `docs/beslissingen.md` te lezen en bij te werken.
