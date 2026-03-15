/**
 * Send a couple of test logs to Datadog (for verifying the HTTP intake works).
 * Run: pnpm exec tsx scripts/send-test-logs.ts
 */
import 'dotenv/config';

async function main() {
  const API_KEY = process.env.DATADOG_API_KEY;
  const SITE = process.env.DD_SITE || 'datadoghq.com';

  if (!API_KEY) {
    console.error('DATADOG_API_KEY not set in .env');
    process.exit(1);
  }

  const logs = [
    {
      message: 'Test log 1 from Dispatch breakable-demo',
      ddsource: 'dispatch-test',
      ddtags: 'env:dispatch,source:dispatch-test',
      hostname: 'breakable-demo-test',
      service: 'dispatch-scanner',
      status: 'info',
    },
    {
      message: 'Test log 2 from Dispatch breakable-demo',
      ddsource: 'dispatch-test',
      ddtags: 'env:dispatch,source:dispatch-test',
      hostname: 'breakable-demo-test',
      service: 'dispatch-scanner',
      status: 'info',
    },
  ];

  const url = `https://http-intake.logs.${SITE}/api/v2/logs`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': API_KEY,
    },
    body: JSON.stringify(logs),
  });

  if (resp.ok) {
    console.log('Sent 2 test logs to Datadog. Check Logs Explorer: service:dispatch-scanner');
  } else {
    console.error(`Failed: ${resp.status} ${resp.statusText}`, await resp.text());
    process.exit(1);
  }
}

main();
