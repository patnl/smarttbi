---
name: project-kickoff
description: Start een nieuw project of grote opdracht op zoals een firma een engagement opstart, zodat Claude als "chief of staff" kan coördineren en parallelle threads niet door elkaar heen werken. Gebruik deze skill altijd wanneer de gebruiker een project, migratie, onderzoek, bouwopdracht of ander omvangrijk werk wil starten, "kickoff", "projectbrief", "opdrachtbrief", CLAUDE.md of een beslissingenbestand noemt, of vraagt hoe hij werk aan Claude moet overdragen, ook als hij het woord "skill" of "playbook" niet gebruikt.
---

# Project-kickoff

Een vage opdracht levert overlappende PR's en verspilde gebruikslimiet op. Een goede brief vooraf is daarom het goedkoopste wat je kunt doen. Stel de gebruiker maximaal een paar gerichte vragen (alleen wat je niet uit de repo of het gesprek kunt afleiden) en schrijf dan de bestanden hieronder.

## 1. Opdrachtbrief
Leg vast, in de taal van de gebruiker:
- **Doel en "klaar als"**: één alinea, met meetbaar eindresultaat.
- **Buiten scope**: wat expliciet niet gedaan wordt.
- **Context**: stack, commando's om te bouwen/testen, bestaande conventies. Lees de repo; vraag het niet.
- **Standing rules**: wat altijd/nooit mag (bv. geen nieuwe dependencies zonder overleg, tests groen vóór PR).
- **Budget**: max. aantal parallelle threads (standaard 2-3) en of werk 's nachts mag doorlopen. Een thread die zijn limiet raakt hervat vanzelf, dus onbeperkt doorlopen kan een hele limiet leegtrekken.

Zet dit in `CLAUDE.md` (bestaat die al, werk hem dan bij in plaats van te overschrijven).

## 2. Beslissingenbestand
Maak `docs/beslissingen.md`: een logboek van `datum - beslissing - reden - door wie`. Alle threads lezen het vóór ze beginnen en voegen toe wat ze beslissen. Zo spreken threads elkaar niet tegen en blijft kennis na een sessie bestaan. Vul het meteen met de beslissingen die al in het gesprek vallen.

## 3. Besluitrechten
Schrijf in de brief welke beslissingen bij de mens blijven (domeinaannames, CI/workflows, alles richting productie, kosten, beveiliging) en welke Claude zelf mag nemen (refactors, tests, naamgeving). Dit is de reviewpoort die later gebruikt wordt.

## Afronding
Toon de gebruiker de brief en vraag om akkoord. Stel dan voor om door te gaan met `project-werkstromen`.
