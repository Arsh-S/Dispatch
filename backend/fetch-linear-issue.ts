import 'dotenv/config';
import { LinearClient } from '@linear/sdk';

const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

async function main() {
  const issues = await client.issues({ filter: { team: { id: { eq: process.env.LINEAR_TEAM_ID } } } });
  const dis13 = issues.nodes.find(i => i.identifier === 'DIS-13');
  if (!dis13) { console.log('DIS-13 not found'); return; }
  const description = await dis13.description;
  console.log('Title:', dis13.title);
  console.log('Description:\n', description);
}

main().catch(console.error);
