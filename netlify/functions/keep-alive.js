const { schedule } = require("@netlify/functions");
const neo4j = require("neo4j-driver");

// Runs daily at 07:00 UTC (keeps AuraDB free tier from pausing due to inactivity)
const handler = async () => {
  const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, NEO4J_DATABASE = "neo4j" } = process.env;

  if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
    console.error("keep-alive: missing NEO4J env vars");
    return { statusCode: 500 };
  }

  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
    { disableLosslessIntegers: true }
  );
  const session = driver.session({ database: NEO4J_DATABASE });

  try {
    await session.run("RETURN 1");
    console.log("keep-alive: Neo4j ping OK");
    return { statusCode: 200 };
  } catch (e) {
    console.error("keep-alive: Neo4j ping failed:", e.message);
    return { statusCode: 500 };
  } finally {
    await session.close();
    await driver.close();
  }
};

module.exports.handler = schedule("0 7 * * *", handler);
