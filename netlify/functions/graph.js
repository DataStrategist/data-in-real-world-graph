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
  // Use elementId (string) instead of identity (Integer) to avoid conversion issues
  const id = n.elementId || String(n.identity);
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
  
  // Build rich tooltip with metadata (plain text format - HTML not supported by vis-network)
  let title = `${String(label).replace(/\n/g, ' ')}\n`;
  title += `[${group}]\n`;
  
  // Add description if available
  if (props.description) {
    title += `\n${props.description}\n`;
  }
  
  // Add category/track info
  if (props.category) {
    title += `\n• Category: ${props.category}`;
  }
  if (props.track) {
    title += `\n• Track: ${props.track}`;
  }
  
  // Add URL for videos (shown as text)
  if (props.linkedin_url || props.url) {
    title += `\n\n🔗 ${props.linkedin_url || props.url}`;
  }
  
  // Add metrics for videos (handle different time period suffixes)
  const impressions = props.impressions_7day || props.impressions_1day || props.impressions;
  const reactions = props.reactions_7day || props.reactions_1day || props.reactions;
  const reach = props.reach_7day || props.reach_1day || props.reach;
  
  if (impressions || reactions || reach) {
    title += `\n`;
    if (impressions) title += `\n👁️  ${impressions.toLocaleString()} impressions`;
    if (reactions) title += `\n❤️  ${reactions} reactions`;
    if (reach) title += `\n📊 ${reach.toLocaleString()} reach`;
  }
  
  // Add publication date for videos
  if (props.published_date) {
    title += `\n📅 ${props.published_date}`;
  }
  
  return { id, label: String(label), group, title, ...props };
}

function relToVis(r) {
  // Use elementId (string) instead of identity/start/end (Integer) to avoid conversion issues
  const id = r.elementId || String(r.identity);
  const from = r.startNodeElementId || String(r.start);
  const to = r.endNodeElementId || String(r.end);
  
  return {
    id,
    from,
    to,
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
    MATCH (n)-[r]-(m)
    RETURN n, r
    LIMIT $rowLimit
  `;

  const NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";

  const session = getDriver().session({ database: NEO4J_DATABASE });

  try {
    const result = await session.run(cypher, {
      rowLimit: neo4j.int(ROW_LIMIT)
    });

    const nodes = new Map();
    const edges = new Map();

    for (const record of result.records) {
      const n = record.get("n");
      const r = record.get("r");
      // Use explicit null/undefined checks - Neo4J objects can be falsy even when not null!
      if (n !== null && n !== undefined && (n.elementId || n.identity)) {
        const nodeId = n.elementId || String(n.identity);
        nodes.set(nodeId, nodeToVis(n));
      }
      if (r !== null && r !== undefined && (r.elementId || r.identity)) {
        const relId = r.elementId || String(r.identity);
        edges.set(relId, relToVis(r));
      }
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
