import { spawnSync } from 'node:child_process';

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    process.exit(result.status ?? 1);
  }

  return result.status ?? 1;
}

const shouldAttemptMigrate = process.env.SKIP_PRISMA_MIGRATE_DEPLOY !== '1';

if (shouldAttemptMigrate) {
  const migrateStatus = run('prisma', ['migrate', 'deploy'], { allowFailure: true });

  if (migrateStatus !== 0) {
    console.warn('\n[build:vercel] prisma migrate deploy failed; continuing with Next.js build.');
    console.warn('[build:vercel] Set SKIP_PRISMA_MIGRATE_DEPLOY=1 to skip migration entirely.\n');
  }
}

run('next', ['build']);
