# Copilot Code komt naar Frontier: apps bouwen in een eigen tab, met kosten onder beheer van de beheerder

Microsoft rolt eind oktober 2026 Copilot Code uit in het Frontier-programma. Het is een nieuwe tab in de Copilot-app, naast Chat en Cowork. Je beschrijft in gewone taal wat je nodig hebt. Copilot bouwt er een app, dashboard of script van, met een live voorbeeld.

## Wat is het

Copilot Code gebruikt desgewenst je Microsoft 365-gegevens als context: documenten, e-mail, vergaderingen en agenda. Dat gebeurt met jouw toestemming en binnen jouw rechten. Gepubliceerde apps draaien op Copilot Managed Runtime, een door Microsoft beheerde cloudomgeving. Ze nemen de beveiliging en het beheer van de organisatie over.

## Een praktijkvoorbeeld

Een Microsoft 365-consultant liet op LinkedIn zien hoe Chat, Cowork en Code samenwerken. Die persoon noteert elke dag ideeën voor posts in een bestand op OneDrive en stuurde de beste handmatig door naar marketing. Nu loopt het zo:

- Cowork draait elke maandag om 07.00 uur een geplande taak.
- De taak leest het ideeënbestand, kiest de vijf beste en zet ze in een SharePoint-lijst.
- In de Code-tab bouwde de consultant een Kanban-bord in dark mode bovenop die lijst.
- Een kaart slepen van Idee naar Uitgewerkt naar Ingepland slaat de wijziging terug in SharePoint.

Volgens de consultant kun je tijdens het bouwen van model wisselen (Claude Opus, Sonnet, GPT) en loont een sterker model als de app ingewikkeld wordt. Die modelkeuze komt uit het LinkedIn-bericht. In de Microsoft-bronnen die wij raadpleegden stond ze niet.

## Wie mag het gebruiken

- Gebruikers in het Frontier-programma met een Microsoft 365 Copilot-licentie.
- Alleen als usage-based billing aan staat en er een spending policy is.
- Cloudsessies staan standaard aan voor wie aan die eisen voldoet.
- Lokaal coderen op de pc staat standaard uit. Een beheerder zet het aan via de instelling Code execution location (Cloud and local) in het Microsoft 365 admin center.
- De koppeling met GitHub is optioneel en moet door een beheerder worden ingeschakeld.

## Wat kost het

Code draait op verbruik, in Copilot Credits bovenop de licentie. Er wordt niets in rekening gebracht zolang een beheerder geen spending policy heeft ingesteld. Microsoft heeft nog geen tarieven per eenheid gepubliceerd. De consultant liet in de demo de Cowork-credits voor en na zien om het verbruik zichtbaar te maken. De bedragen daaruit zijn hier niet overgenomen.

## Wat betekent dit voor TBI

- Beheerders bepalen wie Code krijgt, via spending policies en de executielocatie. Zonder beleid kan niemand erop uitgeven.
- Gebruikers kunnen zelf kleine bedrijfsapps bouwen op SharePoint-lijsten. Dat vraagt afspraken over eigenaarschap, beheer en wat er met gegevens mag gebeuren.
- Claude-modellen in Microsoft 365 Copilot worden gehost buiten door Microsoft beheerde omgevingen en vallen onder de voorwaarden van Anthropic. Een beheerder moet dat inschakelen.

## Voorbehoud

Over het tijdstip van de uitrol zijn de bronnen niet eensgezind: Microsoft noemt eind oktober, één derde partij schrijft dat het Frontier-cohort al eind september begon. Het bericht is samengesteld uit een LinkedIn-bericht en secundaire bronnen. De officiële Microsoft Learn-pagina's waren vanuit deze omgeving niet bereikbaar en zijn niet zelf gelezen.

## Bronnen

- [Copilot Code overview (Frontier), Microsoft Learn](https://learn.microsoft.com/en-us/copilot/code/overview)
- [Use Copilot Code (Frontier), Microsoft Learn](https://learn.microsoft.com/en-us/copilot/code/use-code)
- [MC1519871: Copilot Code is rolling out in Frontier](https://mc.merill.net/message/MC1519871)
- [Copilot Code is rolling out in Frontier, M365 Admin](https://m365admin.handsontek.net/copilot-code-rolling-frontier/)
- [Copilot Code and Managed Runtime explained, Five Forward](https://fiveforward.co.uk/insights/copilot-code-and-managed-runtime-explained/)
- [Claude is now available in Microsoft 365 Copilot, Anthropic](https://www.anthropic.com/news/claude-now-available-in-microsoft-365-copilot)
