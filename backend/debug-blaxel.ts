import 'dotenv/config';
import { SandboxInstance } from '@blaxel/core';

async function main() {
  const name = `debug-test-${Date.now()}`;
  console.log(`Creating sandbox: ${name}`);

  const sandbox = await SandboxInstance.createIfNotExists({
    name,
    region: process.env.BL_REGION || 'us-pdx-1',
    ttl: '5m',
  });

  console.log('Sandbox created. Metadata:', JSON.stringify(sandbox.metadata, null, 2));

  // List existing processes
  try {
    const procs = await sandbox.process.list();
    console.log('Existing processes:', JSON.stringify(procs, null, 2));
  } catch (e) {
    console.log('Could not list processes:', e);
  }

  // Try creating a simple process
  const procName = `test-${Date.now()}`;
  console.log(`Creating process: ${procName}`);
  try {
    const result = await sandbox.process.exec({
      name: procName,
      command: 'echo hello',
      workingDir: '/',
      waitForCompletion: true,
      timeout: 30,
    });
    console.log('Process result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.log('Process exec error:', e);
  }

  await sandbox.delete();
  console.log('Sandbox deleted.');
}

main().catch(console.error);
