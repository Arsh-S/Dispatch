import 'dotenv/config';
import { SandboxInstance } from '@blaxel/core';

async function main() {
  const sandboxes = await SandboxInstance.list();
  console.log('Active sandboxes:', JSON.stringify(sandboxes?.map((s: any) => s.name || s.metadata?.name), null, 2));
}

main().catch(console.error);
