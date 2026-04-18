---
name: surdej-db
description: Backup and restore the dev PostgreSQL database (Docker)
---

## Objective
Backup or restore the Surdej development PostgreSQL database running inside Docker Compose.

## Prerequisites
- Docker Compose services must be running (`docker compose up -d`)
- The `postgres` service must be healthy

## Connection Details
These are read from `docker-compose.yml` — do not hardcode elsewhere:
- **Service**: `postgres`
- **User**: `surdej`
- **Password**: `surdej_dev`
- **Database**: `surdej`
- **Image**: `pgvector/pgvector:pg15`

## Backup Directory
All backups are stored in `backups/` at the repo root. This directory is gitignored.

---

## Commands

### 1. Backup

Create a timestamped compressed backup:

// turbo
```bash
mkdir -p backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/surdej_${TIMESTAMP}.sql.gz"
docker compose exec -T postgres pg_dump -U surdej -d surdej --clean --if-exists | gzip > "$BACKUP_FILE"
echo "✅ Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
```

### 2. List Backups

Show all available backups:

// turbo
```bash
echo "📦 Available backups:"
ls -lh backups/surdej_*.sql.gz 2>/dev/null || echo "  (no backups found)"
```

### 3. Restore (from latest)

Restore the most recent backup:

```bash
LATEST=$(ls -t backups/surdej_*.sql.gz 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  echo "❌ No backups found in backups/"
  exit 1
fi
echo "🔄 Restoring from: $LATEST"
echo "⚠️  This will DROP and recreate all tables in the 'surdej' database."
gunzip -c "$LATEST" | docker compose exec -T postgres psql -U surdej -d surdej --single-transaction
echo "✅ Restore complete from: $LATEST"
```

### 4. Restore (from specific file)

Restore from a specific backup file (agent should ask user which file):

```bash
# Replace BACKUP_FILE with the actual path
BACKUP_FILE="backups/surdej_YYYYMMDD_HHMMSS.sql.gz"
echo "🔄 Restoring from: $BACKUP_FILE"
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U surdej -d surdej --single-transaction
echo "✅ Restore complete"
```

### 5. Quick Schema-Only Backup

Backup only the schema (no data) — useful for migration snapshots:

// turbo
```bash
mkdir -p backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SCHEMA_FILE="backups/surdej_schema_${TIMESTAMP}.sql"
docker compose exec -T postgres pg_dump -U surdej -d surdej --schema-only --clean --if-exists > "$SCHEMA_FILE"
echo "✅ Schema backup: $SCHEMA_FILE ($(du -h "$SCHEMA_FILE" | cut -f1))"
```

---

## Notes
- Backups use `--clean --if-exists` so restores will DROP existing objects first
- Restore uses `--single-transaction` for atomicity
- The `backups/` directory should be added to `.gitignore`
- For production backups, use the AKS kubectl approach (see surdej-release workflow)
