const neo4j = require("neo4j-driver");

// Set these in Netlify (Site settings → Environment variables):
// NEO4J_URI        e.g. neo4j+s://c28327ff.databases.neo4j.io
// NEO4J_USER       your Neo4j username
// NEO4J_PASSWORD   your Neo4j password (keep secret; do NOT commit it)
// NEO4J_DATABASE   usually neo4j
// NODE_LIMIT       optional, default 200 (max 300)
// ROW_LIMIT        optional, default 1200 (max 2000)
// CACHE_SECONDS    optional, default 300 (min 30)

let driver;
function getDriver() {
  if (driver) return driver;
  const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } = process.env;
  if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
    throw new Error("Missing NEO4J_URI/NEO4J_USER/NEO4J_PASSWORD env vars");
  }
  driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
    { disableLosslessIntegers: true }
  );
  return driver;
}

// In-memory cache (persists across warm invocations)
let cache = { ts: 0, payload: null };

function nodeToVis(n) {
  // Neo4J Integer objects can overflow JavaScript Number - convert directly to string
  const nodeId = n.identity?.toString ? n.identity.toString() : String(n.identity);
  const id = nodeId;
  const labels = n.labels || [];
  const props = n.properties || {};
  const group = labels[0] || "Node";
  let label = props.title || props.name || props.id || group;
  
  // Wrap long labels at word boundaries
  if (typeof label === 'string' && label.length > 30) {
    const words = label.split(' ');
    let lines = [];
    let currentLine = '';
    
    for (const word of words) {
      if ((currentLine + ' ' + word).length > 30 && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      }
    }
    if (currentLine) lines.push(currentLine);
    label = lines.join('\n');
  }
  
  return { id, label: String(label), group, ...props };
}

function relToVis(r) {
  // Neo4J Integer objects can overflow JavaScript Number - convert directly to string
  const relId = r.identity?.toString ? r.identity.toString() : String(r.identity);
  const fromId = r.start?.toString ? r.start.toString() : String(r.start);
  const toId = r.end?.toString ? r.end.toString() : String(r.end);
  
  return {
    id: relId,
    from: fromId,
    to: toId,
    type: r.type,
    label: r.type
  };
}

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const CACHE_SECONDS = Math.max(Number(process.env.CACHE_SECONDS || 300), 30);
  const now = Date.now();
  if (cache.payload && (now - cache.ts) < CACHE_SECONDS * 1000) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(cache.payload)
    };
  }

  // User-requested query pattern:
  // MATCH (n) OPTIONAL MATCH (n)-[r]-() RETURN n, r;
  //
  // Public endpoints must be bounded to avoid timeouts/DoS.
  const NODE_LIMIT = Math.min(parseInt(process.env.NODE_LIMIT || '200', 10), 300);
  const ROW_LIMIT = Math.min(parseInt(process.env.ROW_LIMIT || '1200', 10), 2000);

  const cypher = `
    MATCH (n)
    WITH n LIMIT $nodeLimit
    WITH collect(n) as nodes
    UNWIND nodes as n
    OPTIONAL MATCH (n)-[r]-(m)
    WHERE m IN nodes
    RETURN n, r
    LIMIT $rowLimit
  `;

  const NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";

  const session = getDriver().session({ database: NEO4J_DATABASE });

  try {
    const result = await session.run(cypher, {
      nodeLimit: neo4j.int(NODE_LIMIT),
      rowLimit: neo4j.int(ROW_LIMIT)
    });

    const nodes = new Map();
    const edges = new Map();

    for (const record of result.records) {
      const n = record.get("n");
      const r = record.get("r");
      if (n?.identity) nodes.set(String(n.identity), nodeToVis(n));
      if (r?.identity) edges.set(String(r.identity), relToVis(r));
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      limits: { nodeLimit: NODE_LIMIT, rowLimit: ROW_LIMIT },
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values())
    };

    cache = { ts: now, payload };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(payload)
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ error: e.message })
    };
  } finally {
    await session.close();
  }
};
