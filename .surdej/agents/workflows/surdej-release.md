---
name: surdej-release
description: Create a new GitHub release with auto-generated notes and deploy to production
---

## Steps

1. **Interview and Version Confirmation**
   - Check the `version` field currently present in `surdej.yaml`.
   - Ask the user what the *new* semantic version number should be (e.g., bump from `0.0.2` to `0.0.3` or `0.1.0`).

2. **Pre-release Database Backup**
   - Create a timestamped compressed backup of the PostgreSQL database into the local `data/` folder.
   - This backup is the safety net — if the release fails or corrupts the database, use `surdej-recover` to restore.
   // turbo
   ```bash
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   VERSION=$(grep '^version:' surdej.yaml | awk '{print $2}' | tr -d '"')
   BACKUP_FILE="data/pre-release_v${VERSION}_${TIMESTAMP}.sql.gz"
   mkdir -p data
   echo "Creating pre-release backup → ${BACKUP_FILE}"
   docker compose exec -T postgres pg_dump -U surdej -d surdej --clean --if-exists | gzip > "${BACKUP_FILE}"
   BACKUP_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
   echo "✅ Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"
   ```
   - Verify the backup file is non-empty before proceeding.
   // turbo
   ```bash
   BACKUP_FILE=$(ls -t data/pre-release_*.sql.gz 2>/dev/null | head -1)
   if [ ! -s "${BACKUP_FILE}" ]; then
       echo "❌ Backup file is empty or missing — aborting release!"
       exit 1
   fi
   echo "✅ Backup verified: ${BACKUP_FILE}"
   ```

3. **Update the Manifest**
   - Natively edit the `surdej.yaml` file to safely bump the `version` string to the new target.

4. **Commit Version Bump**
   // turbo
   ```bash
   git add surdej.yaml && git commit -m "chore(release): bump version to v[NEW_VERSION]"
   ```

5. **Tag the Release**
   // turbo
   ```bash
   git tag "v[NEW_VERSION]"
   ```

6. **Push to Trigger CI/CD**
   // turbo
   ```bash
   git push origin main && git push origin "v[NEW_VERSION]"
   ```
   > *Note: Pushing this tag automatically triggers `.github/workflows/build-containers.yml`, building and pushing Docker images to GHCR.*

7. **Create GitHub Release**
   // turbo
   ```bash
   gh release create "v[NEW_VERSION]" --generate-notes --title "Release v[NEW_VERSION]"
   ```

8. **Post-release Note**
   - Inform the user:
     > Pre-release database backup saved to `data/pre-release_v[OLD_VERSION]_[TIMESTAMP].sql.gz`.
     > If anything goes wrong, run **`surdej-recover`** to roll back the database and version tag.
