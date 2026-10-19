# SharePoint-inrichting voor DMS en kennisbank

Status: concept ter review. Opgesteld op 2026-10-19 na een grill-me-sessie met Jeroen Pat.
Dit plan hoort in de nieuwe repo waar de inrichting als code komt te staan. Naam volgens `<team>-<type>-<naam>` (zie `tbi-naming`), nog te kiezen. Tot die repo er is staat het hier.

## Doel

Een omgeving waar een document van idee via werkdocument en review (meerdere rondes) tot eind-document komt, samenhang houdt met andere documenten, en later vervangen en gearchiveerd kan worden. Het pijnpunt van nu: veel versies op veel plekken, en niemand weet de status.

Voor: smarttbi, alle innovatiestukken, het AI-team, het AI-quality-team, en een kennisbank die agents, medewerkers en soms externen gebruiken.

## Besluiten

| # | Besluit | Reden |
|---|---------|-------|
| 1 | Twee gekoppelde modellen: (A) werkomgeving met levenscyclus, (B) kennisbank met alleen goedgekeurde inhoud. Een document gaat van A naar B door Published te worden, zonder kopie. | Antwoord op de pijn: één vindplaats per document. Werkaanname, de gebruiker beantwoordde dit met het pijnpunt en niet met een expliciet ja. Corrigeren mag. |
| 2 | Levenscyclus volgt de ISO 19650-toestanden: WIP, Shared, Published, Archive. Als mappen of zones plus status, revisie en geschiktheid als metadata. Een reviewronde is een nieuwe revisie in Shared. | Herkenbaar, auditbaar, rechten per toestand af te dwingen. |
| 3 | Rollen per document: eigenaar, reviewer, goedkeurder. Goedkeuring maakt het Published en vergrendelt het als record. Vervangen is een nieuwe versie die de oude naar Archive verplaatst met verwijzing. | Gebruiker koos meerdere reviewrondes met drie rollen. |
| 4 | Het innovatieportaal houdt projecten en taken. SharePoint houdt de documenten. Koppeling via trackingcode `INN-jjjj-nnnn` in een metadatakolom. | Geen dubbel bijhouden. Portaalstructuur blijft werken. |
| 5 | ADR's, specs, plannen en README's blijven in Git. SharePoint krijgt een kennisbankkaart met verwijzing. Rapporten, presentaties en besluiten voor mensen zonder repo staan in SharePoint. | Teams werken in Git. Collega's en externen niet. |
| 6 | Agents lezen standaard alleen Published. Werkt een agent namens een gebruiker, dan gelden diens rechten, dus ook WIP waar die toegang toe heeft. Externen krijgen alleen een aparte extern-gedeelde zone. | Een agent die een concept als gezaghebbend aanhaalt is het grootste kwaliteitsrisico. |
| 7 | Bouwen en testen eerst in een test- of developertenant. Productie via een RfC bij SSC-ICT (skill `tbi-rfc`). | Sites, labels en Purview-beleid zijn lastig terug te draaien. |
| 8 | Bestaande documenten worden allemaal gemigreerd. Dat kost handmatig statusoordeel per document. We verkleinen die last met een inventaris, duplicaatdetectie en een voorgestelde status die een mens bevestigt. | Gebruikerskeuze. Risico staat onder "Wat kan stuklopen". |
| 9 | Ontwerp is onafhankelijk van de naamgeving in ISO 19650:2018 of de herziening. | De herziening is nog concept, zie bronnen. |
| 10 | Geen eigen DMS-product bouwen. We gebruiken SharePoint, Purview en wat Microsoft levert. | Bouw het minimum, zie teamregels. |

## Oplevering

1. Ontwerpdocument: informatiearchitectuur, metadata, statusmachine, rollen en rechten, retentie, kennisbank en agenttoegang, migratie.
2. Inrichting als code in een nieuwe repo, reproduceerbaar uit te rollen op de testtenant.
3. Migratieplan met inventaris en triage.

## Randvoorwaarden voor elke taak

- Alles in het Nederlands, volgens de repotaal.
- Elke wijziging in de testtenant moet met de code te herhalen zijn. Geen handwerk dat nergens staat.
- Geen secrets, tenant-ID's of tokens in de repo. Gebruik Key Vault of omgevingsvariabelen.
- Bewaartermijnen en classificaties zijn een voorstel tot ze door informatiebeheer of juridische zaken zijn bevestigd.
- Eerst de test, zie `test-first`, waar de repo een testrunner heeft. Zo niet, vraag eerst.

## Interfaces tussen taken

- `status.schema.json` (taak 2): lijst met toestand, statuscode, toegestane overgangen en rol die de overgang mag uitvoeren. Taken 3, 5 en 6 lezen deze.
- `metadata.schema.json` (taak 2): kolommen en content types, met naam, type en verplichting. Taken 3, 4 en 8 lezen deze.
- `rollen.json` (taak 5): rol naar Entra-groep of site-groep. Taken 4 en 7 lezen deze.

## Taken

Taak 1 tot en met 3 zijn volledig uitgewerkt. Taak 4 en verder worden uitgewerkt na taak 1, omdat de toolkeuze en de nationale bijlage daar bepalen wat de commando's worden. Dat is bewust en geen "later".

### Taak 1. Verkenning en ontwerpkeuzes

- Bestand: `docs/ontwerp/01-verkenning.md`.
- Inhoud:
  - Controleer de Nederlandse nationale bijlage bij NEN-EN-ISO 19650 en de actuele CB-NL-versie via NEN en BIM Loket.
  - Controleer de conceptteksten van de herziening, vooral de hernoemde documenten (EIR, BEP, MIDP) en wat de CDE nu eist.
  - Kies tooling (PnP provisioning of Microsoft Graph met Bicep) op basis van actuele Microsoft-documentatie.
  - Leg vast welke SharePoint Premium-functies en Purview-licenties TBI heeft.
- Test: geen. Controle is dat elke bewering een bronlink heeft.
- Commando: `grep -c "http" docs/ontwerp/01-verkenning.md`
- Expected: een getal groter dan het aantal beweringen die een bron nodig hebben, en geen alinea over de buitenwereld zonder link.

### Taak 2. Statusmachine en metadata als data

- Bestanden: `schema/status.schema.json`, `schema/metadata.schema.json`, `tests/schema.test.mjs`.
- Eerst de test. Naam het gedrag dat hij vangt:
  - Een overgang van WIP naar Published zonder Shared moet falen (vangt: review overslaan).
  - Een document in Archive mag niet terug naar WIP (vangt: gearchiveerd document stilletjes weer bewerken).
  - Elk document in Published heeft een goedkeurder en een revisie (vangt: onbekende status).
  - Een niet-bestaande statuscode wordt geweigerd.
- Commando: `node --test tests/schema.test.mjs`
- Expected: eerst rood met de vier redenen hierboven, daarna `# pass 4` en `# fail 0`.

### Taak 3. Ontwerp van de sitestructuur

- Bestand: `docs/ontwerp/03-sitestructuur.md`.
- Inhoud: hub voor het geheel, per initiatief of team een site met bibliotheken voor WIP, Shared, Published en Archive, een kennisbanksite met alleen Published, en een extern-gedeelde zone. Per laag staat wie wat mag.
- Controle: elke toestand uit `status.schema.json` heeft precies één plek, en elke plek verwijst naar een toestand.
- Commando: `node scripts/check-structuur.mjs`
- Expected: `OK: elke toestand heeft één plek` en exitcode 0.

### Taken 4 tot en met 9, uit te werken na taak 1

| Taak | Onderwerp | Uitkomst |
|------|-----------|----------|
| 4 | Inrichting van de testtenant als code | Hub en sites worden herhaalbaar aangemaakt |
| 5 | Rollen en rechten | `rollen.json`, afgedwongen per toestand, gasttoegang beperkt tot de externe zone |
| 6 | Retentie en records | Purview-labels met vergrendelen bij Published, versie bewaren per vergrendeling |
| 7 | Agenttoegang tot de kennisbank | Alleen Published, namens-gebruiker-modus voor het overige |
| 8 | Migratie | Inventaris van alle bronnen, duplicaatdetectie, voorgestelde status, menselijke bevestiging |
| 9 | Proef met twee echte initiatieven | Werkt het proces voor smarttbi en een AI-team-initiatief? |

## Wat kan stuklopen

- **Dubbel gemigreerde documenten.** Hetzelfde bestand staat in Teams, OneDrive en een mailbijlage. Taak 8 begint met een hash-vergelijking, en een test dekt het geval met twee gelijke bestanden onder verschillende namen.
- **Document zonder eigenaar.** Veel bestaande documenten hebben geen duidelijke eigenaar. Migratie kent die niet toe, maar zet de status op "eigenaar nodig".
- **Onbekende status bij migratie.** Geen gokken. Een document zonder bevestigde status blijft in een apart wachtgebied, niet in Published.
- **Gasten in WIP of Shared.** De test voor taak 5 controleert dat een gastaccount nooit een bibliotheek buiten de externe zone ziet.
- **Lege kolommen of ontbrekende goedkeurder in Published.** Taak 2 weigert dit al in het schema.
- **Vergrendeld record dat nog bewerkt moet worden.** Dat loopt via een nieuwe versie, niet via ontgrendelen. De procedure staat in taak 6.
- **Duplicaat tussen Git en SharePoint.** Besluit 5 scheidt dit. Een document staat in één van de twee en de andere kant verwijst alleen.

## Open punten

- Werkaanname bij besluit 1 laten bevestigen.
- Nationale bijlage, CB-NL en de herziening van ISO 19650 controleren (taak 1).
- Bewaartermijnen en classificatie laten bevestigen door informatiebeheer en juridische zaken.
- Tenant en licenties: onbekend welke Purview- en SharePoint Premium-functies beschikbaar zijn.
- Naam van de nieuwe repo.

## Bronnen

- [ISO 19650 Updates](https://www.bimenable.com/iso-19650-updates)
- [DIN-concept ISO/DIS 19650-2:2026](https://www.dinmedia.de/en/draft-standard/din-en-iso-19650-2/400102235)
- [ISO 19650 Revision 2026 (Graitec)](https://graitec.com/uk/blog/iso-19650-revision-2026/)
- [Autodesk: ISO 19650 CDE en Autodesk Construction Cloud](https://www.autodesk.com/autodesk-university/article/ISO-19650-Common-Data-Environment-and-Autodesk-Construction-Cloud)
- [UK BIM Framework, deel C: CDE-workflow en technische oplossingen](https://www.ukbimframework.org/wp-content/uploads/2021/02/Guidance-Part-C_Facilitating-the-common-data-environment-workflow-and-technical-solutions_Edition-1.pdf)
- [Microsoft Learn: record versioning](https://learn.microsoft.com/en-us/purview/record-versioning)
