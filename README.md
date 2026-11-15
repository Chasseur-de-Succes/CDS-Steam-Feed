# CDS-Steam-Feed

Bot qui surveille les ajouts/suppressions de succès Steam et les publie
via webhook Discord (salon + threads Ajouts/Supprimés/Nouveaux).

Partage la base PostgreSQL de [CDS-BOT](https://github.com/Chasseur-de-Succes/CDS-BOT).

## Stack

- Node.js (discord.js v14, steam-user)
- PostgreSQL — Knex + Objection.js (schéma géré par CDS-BOT)

## Prérequis

- Node.js 20+
- Une BDD PostgreSQL au schéma CDS-BOT (tables `Game`, `Achievement`, `GuildConfig`)

## Configuration

Copier `example.env` en `.env` :

| Variable | Description |
|---|---|
| `TOKEN` | Token du bot Discord |
| `CLIENTID` | ID de l'application Discord |
| `STEAM_API_KEY` | Clé API Steam |
| `DATABASE_URL` | `postgres://user:pwd@host:5432/db` |

## Lancement

```
npm install
node index.js
```

Docker :

```
docker compose up -d --build
```

## Fonctionnement

1. `steam-user` écoute le PICS (`changelist` / `appUpdate`).
2. Jeux inconnus → création en BDD ; connus → comparaison des succès.
3. Diff publié par webhook dans le salon feed, avec threads par catégorie.
