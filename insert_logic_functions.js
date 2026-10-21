const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5433/default'
  });
  await client.connect();

  const manifest = JSON.parse(fs.readFileSync('packages/twenty-apps/internal/lavivenzia-crm/.twenty/output/manifest.json', 'utf8'));
  const appId = 'a4974b4b-4a94-4c7e-a0e0-9b87c214636e';
  const workspaceId = '20202020-1c25-4d02-bf25-6aeccf7ea419';

  for (const func of manifest.logicFunctions) {
    const query = `
      INSERT INTO core."logicFunction" (
        "id", "name", "description", "runtime", "timeoutSeconds", "workspaceId",
        "createdAt", "updatedAt", "universalIdentifier", "applicationId",
        "checksum", "sourceHandlerPath", "handlerName", "isTool", "builtHandlerPath",
        "cronTriggerSettings", "databaseEventTriggerSettings", "httpRouteTriggerSettings",
        "isBuildUpToDate", "executionMode"
      ) VALUES (
        gen_random_uuid(), $1, $2, 'nodejs20.x', $3, $4,
        now(), now(), $5, $6,
        $7, $8, $9, false, $10,
        $11, $12, $13,
        true, 'PREBUILT'
      )
    `;
    const params = [
      func.name,
      func.description || '',
      func.timeoutSeconds || 15,
      workspaceId,
      func.universalIdentifier,
      appId,
      func.builtHandlerChecksum || '',
      func.sourceHandlerPath || '',
      func.handlerName || '',
      func.builtHandlerPath || '',
      func.cronTriggerSettings ? JSON.stringify(func.cronTriggerSettings) : null,
      func.databaseEventTriggerSettings ? JSON.stringify(func.databaseEventTriggerSettings) : null,
      func.httpRouteTriggerSettings ? JSON.stringify(func.httpRouteTriggerSettings) : null
    ];
    try {
      await client.query(query, params);
      console.log(`Inserted ${func.name}`);
    } catch (e) {
      console.error(`Failed ${func.name}: ${e.message}`);
    }
  }

  await client.end();
}

main().catch(console.error);
