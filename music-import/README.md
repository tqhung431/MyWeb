# Songs to import

Put song files here (for example the 12 starter-pack songs from ccMixter, see docs/stage-8.md), then:

- Docker: `docker compose exec api node dist/music/import.js /import`
- Without Docker: `cd api && npm run music:import -- ../music-import`

Song files in this folder are not committed to git.
