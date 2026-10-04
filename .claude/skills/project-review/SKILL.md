---
name: project-review
description: Beoordeel en voeg samen wat parallelle threads of subagents hebben opgeleverd: PR's, branches en tussenresultaten. Controleert op overlap, conflicten, tegenstrijdige aannames en of de "klaar als"-criteria gehaald zijn, en bepaalt wat de mens moet goedkeuren. Gebruik deze skill wanneer threads klaar zijn, de gebruiker vraagt "wat is er gebeurd", "check de PR's", "voeg samen", "review de resultaten", of een statusoverzicht van een lopend project wil, ook zonder het woord review.
---

# Review en samenvoegen

Menselijke review is de bottleneck bij parallel werk. Jouw taak is die review makkelijk te maken: eerst zelf alles controleren, dan de gebruiker alleen de beslissingen voorleggen.

## Per thread controleren
- Is het "klaar als"-criterium gehaald? Draai de tests en checks zelf; geloof de samenvatting van de thread niet blind.
- Zit de wijziging binnen de eigen bestanden van de werkstroom? Zo niet, markeer dat.
- Is `docs/beslissingen.md` bijgewerkt met wat de thread besloot?
- Staat er iets in dat bij de mens hoort (domeinaannames, CI, productie, kosten, beveiliging)?

## Over threads heen
- Zoek overlap en conflicten tussen branches; bepaal een merge-volgorde (basiswerk eerst).
- Zoek tegenstrijdige aannames (zelfde getal of regel op twee manieren gekozen).
- Los eenvoudige conflicten zelf op; leg inhoudelijke keuzes voor.

## Rapportage
Geef een korte statustabel: werkstroom, status (klaar / blokkeert / afgekeurd), wat er gecontroleerd is, open punten. Sluit af met een lijst **"Jouw beslissing nodig"** met per punt een aanbeveling. Merge nooit zelf zonder akkoord van de gebruiker en wijzig nooit de goedkeuringsregels om iets door te krijgen.
