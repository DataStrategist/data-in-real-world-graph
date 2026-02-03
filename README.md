# Neo4j full-screen graph (Netlify)

## Deploy
1. Create a new Netlify site from this repo.
2. Set env vars in Netlify:
   - NEO4J_URI = neo4j+s://c28327ff.databases.neo4j.io
   - NEO4J_USER = your Neo4j username
   - NEO4J_PASSWORD = your Neo4j password
   - NEO4J_DATABASE = neo4j
   Optional:
   - NODE_LIMIT, ROW_LIMIT, CACHE_SECONDS

## Local dev (optional)
- Install Netlify CLI and run:
  - npm i
  - cp .env.example .env  (fill in real values locally)
  - netlify dev
