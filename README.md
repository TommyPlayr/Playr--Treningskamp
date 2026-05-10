# Playr Treningskamp

Dette er et komplett startoppsett for en enkel mobilapp der trenere kan legge ut, finne og avtale treningskamper.

## Hva appen inneholder

- Hjem-skjerm med `Finn kamper` og `Legg ut kamp`
- Nederste navigasjon med `Hjem`, `Kamper`, `Innboks` og `Mine`
- Opprettelse av treningskamp
- Automatisk utfylte felt for innlogget trener: lag, klubb og kontaktperson
- Valg mellom `Fotball` og `Handball`
- Liste over åpne og avtalte kamper
- Statusfarger:
  - `Ledig`: lys grønn
  - `Avtalt`: mørk grønn
  - `Avslatt`: rød kun for den enkelte treneren i egne forespørsler
- Send forespørsel på en kamp
- Godkjenn eller avslå forespørsel
- Ved godkjenning endres kampen til `avtalt`
- Ved avslag på en tidligere godkjent forespørsel endres kampen tilbake til `ledig`
- Enkel chat på forespørsel
- Lokale demo-data slik at flyten kan testes før database kobles på

## Kom i gang

Installer avhengigheter:

```bash
npm install
```

Start appen:

```bash
npm start
```

Deretter kan appen åpnes i Expo Go på mobil, i iOS-simulator, Android-emulator eller i nettleser.

## Kjøring i GitHub Codespaces

Dette er anbefalt hvis PC-en ikke kan installere Node.js lokalt.

1. Opprett et nytt repository på GitHub.
2. Last opp alle filene i denne prosjektmappen til repository-et.
3. Trykk `Code`.
4. Velg `Codespaces`.
5. Trykk `Create codespace on main`.
6. Vent til miljøet er ferdig opprettet.
7. Kjør:

```bash
npm run codespaces
```

Når porten åpnes, velg `Open in Browser` eller `Open Preview`.

## Viktig om neste steg

Denne første versjonen har all appflyt og knappelogikk lokalt i appen. For å gjøre den live for trenere i Norge må neste steg være å koble på:

- innlogging
- database
- ekte brukerprofiler
- lagprofiler
- push-varsler
- lagring av chatmeldinger

Anbefalt backend for neste steg: Supabase eller Firebase.

Jeg har lagt ved et Supabase-utkast i `database/supabase-schema.sql`.

## Foreslått datamodell

### users

- id
- name
- email
- phone
- created_at

### teams

- id
- user_id
- sport
- club
- team
- age_group
- level
- contact_name

### matches

- id
- host_team_id
- sport
- title
- age_group
- level
- date
- time
- place
- city
- match_type
- comment
- status
- approved_request_id
- created_at

### match_requests

- id
- match_id
- from_team_id
- message
- status
- created_at

### chat_messages

- id
- request_id
- sender_user_id
- text
- created_at

## Statuslogikk

- En ny kamp får status `ledig`
- En forespørsel endrer ikke kampstatus; kampen er fortsatt `ledig`
- Når arrangør trykker `Godkjenn`, får forespørselen status `godkjent`, og kampen får status `avtalt`
- Andre ventende forespørsler på samme kamp kan settes til `avslatt`
- Når arrangør trykker `Avsla` på en godkjent forespørsel, settes kampen tilbake til `ledig`
- Avslåtte forespørsler vises rødt kun for de berørte trenerne, ikke i det åpne markedet
