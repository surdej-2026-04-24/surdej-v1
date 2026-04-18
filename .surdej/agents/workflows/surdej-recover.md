---
name: surdej-recover
description: Recover the database and roll back version after a failed release or database corruption
---

## Objective

Restore the PostgreSQL database from a pre-release backup (created by `surdej-release`)
and optionally roll back the Git version tag. Use this when a release has failed,
migrations corrupted the database, or the application is in a broken state after deployment.

## Steps

### 1. Assess the Situation

- Ask the user what happened (failed migration, corrupted data, broken release).
- List available backups in the `data/` folder.
  // turbo
  ```bash
  echo "=== Available Backups (data/) ==="
  ls -lhtr data/*.sql.gz 2>/dev/null || echo "  No backups found in data/"
  echo ""
  echo "=== Available Backups (backups/) ==="
  ls -lhtr backups/*.sql.gz 2>/dev/null || echo "  No backups found in backups/"
  echo ""
  echo "=== Current Version ==="
  grep '^version:' surdej.yaml | awk '{print $2}'
  echo ""
  echo "=== Recent Git Tags ==="
  git tag --sort=-creatordate | head -5
  echo ""
  echo "=== Current Docker Status ==="
  docker compose ps --format "table {{.Name}}\t{{.State}}\t{{.Status}}" 2>/dev/null
  ```

### 2. Choose the Backup to Restore

- Present the list of available `.sql.gz` files to the user.
- Ask which backup to restore (default: the most recent `pre-release_*.sql.gz` in `data/`).
- Confirm with the user before proceeding — **this will overwrite all current database data**.

### 3. Stop Application Services

- Stop the API and workers to prevent writes during restore.
  // turbo
  ```bash
  echo "Stopping API and workers..."
  docker compose stop api pdf-refinery-worker 2>/dev/null
  echo "✅ Services stopped"
  docker compose ps --format "table {{.Name}}\t{{.State}}" 2>/dev/null
  ```

### 4. Restore the Database

- Restore the chosen backup into PostgreSQL.
  ```bash
  BACKUP_FILE="[CHOSEN_BACKUP_PATH]"
  echo "Restoring database from: ${BACKUP_FILE}"
  echo "This will DROP and recreate all tables..."

  gunzip -c "${BACKUP_FILE}" | docker compose exec -T postgres psql -U surdej -d surdej --single-transaction

  echo ""
  echo "✅ Database restored from ${BACKUP_FILE}"
  ```

### 5. Verify Database Integrity

- Check that the database is accessible and tables exist.
  // turbo
  ```bash
  echo "=== Table count ==="
  docker compose exec -T postgres psql -U surdej -d surdej -c "SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema = 'public';"

  echo ""
  echo "=== Key table row counts ==="
  docker compose exec -T postgres psql -U surdej -d surdej -c "
    SELECT 'Tenant' AS entity, count(*) FROM \"Tenant\"
    UNION ALL SELECT 'User', count(*) FROM \"User\"
    UNION ALL SELECT 'Blob', count(*) FROM \"Blob\"
    UNION ALL SELECT 'Session', count(*) FROM \"Session\"
    ORDER BY entity;
  "

  echo ""
  echo "=== Migration status ==="
  docker compose exec -T postgres psql -U surdej -d surdej -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"
  ```

### 6. Restart Services

- Bring the API and workers back up.
  // turbo
  ```bash
  echo "Starting services..."
  docker compose up -d api
  sleep 3
  echo ""
  echo "=== Health check ==="
  curl -s http://localhost:5001/api/health 2>/dev/null || echo "API not yet ready"
  echo ""
  docker compose ps --format "table {{.Name}}\t{{.State}}\t{{.Status}}" 2>/dev/null
  ```

### 7. (Optional) Roll Back Git Version Tag

- If the release tag should be removed, ask the user for confirmation.
- Only do this if the release was **not yet pushed to production** or the user explicitly requests it.
  ```bash
  TAG="v[VERSION_TO_REMOVE]"
  echo "Removing local tag: ${TAG}"
  git tag -d "${TAG}"

  echo "Removing remote tag: ${TAG}"
  git push --delete origin "${TAG}" 2>/dev/null || echo "Remote tag not found (may not have been pushed)"

  echo ""
  echo "=== Remaining recent tags ==="
  git tag --sort=-creatordate | head -5
  ```

### 8. (Optional) Revert the Version Bump Commit

- If the `surdej.yaml` version bump commit should be undone:
  ```bash
  echo "Reverting last commit (version bump)..."
  git log --oneline -3
  git revert HEAD --no-edit
  git push origin main
  ```

### 9. Recovery Summary

- Present a summary to the user:

  | Action | Status |
  |--------|--------|
  | Database restored from | `[BACKUP_FILE]` |
  | Tables verified | ✅ / ❌ |
  | API health | ✅ / ❌ |
  | Git tag rolled back | Yes / No / Skipped |
  | Version commit reverted | Yes / No / Skipped |

- Remind the user:
  > If the issue was caused by a Prisma migration, you may need to manually fix the migration
  > file and re-run `pnpm db:migrate` before the next release attempt.
