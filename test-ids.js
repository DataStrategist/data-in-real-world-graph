// Test script to verify Neo4J node/edge ID matching
const neo4j = require("neo4j-driver");
require('dotenv').config();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME || process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  { disableLosslessIntegers: true }
);

const session = driver.session({ database: 'neo4j' });

async function testIds() {
  const cypher = `
    MATCH (n)
    WITH n LIMIT 5
    OPTIONAL MATCH (n)-[r]->()
    RETURN n, r
    LIMIT 10
  `;

  const result = await session.run(cypher);
  
  console.log('\n=== Testing ID Conversions ===\n');
  
  const nodes = new Map();
  const edges = new Map();
  
  for (const record of result.records) {
    const n = record.get("n");
    const r = record.get("r");
    
    if (n?.identity) {
      const nodeId = n.identity?.toNumber ? n.identity.toNumber() : n.identity;
      const idString = String(nodeId);
      nodes.set(idString, { 
        raw: n.identity, 
        converted: nodeId, 
        string: idString,
        label: n.properties?.title || n.properties?.name || n.labels?.[0]
      });
      console.log(`Node: ${idString} (${n.labels?.[0]}) - "${n.properties?.title || n.properties?.name}"`);
    }
    
    if (r?.identity) {
      const fromId = r.start?.toNumber ? r.start.toNumber() : r.start;
      const toId = r.end?.toNumber ? r.end.toNumber() : r.end;
      const fromString = String(fromId);
      const toString = String(toId);
      
      edges.set(String(r.identity), {
        from: fromString,
        to: toString,
        type: r.type
      });
      
      console.log(`  Edge: ${fromString} -[${r.type}]-> ${toString}`);
      
      // Verify node IDs exist
      if (!nodes.has(fromString)) {
        console.log(`  ⚠️  WARNING: From node ${fromString} not in nodes map!`);
      }
      if (!nodes.has(toString)) {
        console.log(`  ⚠️  WARNING: To node ${toString} not in nodes map!`);
      }
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Total nodes: ${nodes.size}`);
  console.log(`Total edges: ${edges.size}`);
  
  let orphanEdges = 0;
  for (const [edgeId, edge] of edges.entries()) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      orphanEdges++;
      console.log(`Orphan edge: ${edge.from} -[${edge.type}]-> ${edge.to}`);
    }
  }
  
  if (orphanEdges > 0) {
    console.log(`\n❌ Found ${orphanEdges} orphan edges (nodes not in result set)`);
  } else {
    console.log(`\n✅ All edges connect to valid nodes`);
  }
  
  await session.close();
  await driver.close();
}

testIds().catch(console.error);
