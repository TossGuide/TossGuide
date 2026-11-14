import { execFileSync } from 'node:child_process';

/** Build fake-camera videos from fixture photos (the .y4m files are gitignored). */
export default function globalSetup() {
  execFileSync('bash', ['scripts/make-fixtures.sh'], { stdio: 'inherit' });
}
