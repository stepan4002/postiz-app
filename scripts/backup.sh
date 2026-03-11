#!/usr/bin/env bash
# backup.sh — Daily PostgreSQL and MinIO backup for Social Command Centre
#
# Crontab setup (run as root or a user with Docker access):
#   0 3 * * * /opt/social/scripts/backup.sh >> /var/log/social-backup.log 2>&1
#
# Run manually:
#   bash /opt/social/scripts/backup.sh
#
# Prerequisites:
#   - Docker with postiz-postgres container running (container_name: postiz-postgres)
#   - rsync installed on host
#   - Sufficient disk space at BACKUP_DIR
#
# MinIO volume path NOTE:
#   The actual Docker volume path is VPS-specific. Before running for the first time,
#   verify the path with: docker volume inspect postiz_minio-data
#   Look for the "Mountpoint" field and update MINIO_VOLUME_PATH below if needed.

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/social}"
DATE=$(date +%Y%m%d)
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# MinIO Docker volume mount path.
# Run `docker volume inspect postiz_minio-data` on your VPS to verify this path.
MINIO_VOLUME_PATH="${MINIO_VOLUME_PATH:-/var/lib/docker/volumes/postiz_minio-data/_data}"

# PostgreSQL connection settings (must match docker-compose.prod.yaml)
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postiz-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postiz-user}"
POSTGRES_DB="${POSTGRES_DB:-postiz-db-local}"

# ── Setup ────────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR/postgres" "$BACKUP_DIR/minio"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting backup: $DATE"

# ── PostgreSQL Backup ────────────────────────────────────────────────────────
# pg_dump uses MVCC — safe to run against a live PostgreSQL container.
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Dumping PostgreSQL..."

docker exec "$POSTGRES_CONTAINER" pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  | gzip > "$BACKUP_DIR/postgres/postiz-$DATE.sql.gz"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] PostgreSQL dump complete: postgres/postiz-$DATE.sql.gz"

# ── MinIO Backup ─────────────────────────────────────────────────────────────
# Rsync the MinIO Docker volume data directory to the backup location.
# IMPORTANT: Verify MINIO_VOLUME_PATH with `docker volume inspect postiz_minio-data`
# before first run — the Mountpoint path varies by Docker root dir configuration.
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Syncing MinIO data..."

mkdir -p "$BACKUP_DIR/minio/minio-$DATE"
rsync -a "$MINIO_VOLUME_PATH/" "$BACKUP_DIR/minio/minio-$DATE/" 2>/dev/null || {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] WARNING: MinIO rsync failed or source path not found."
  echo "  Verify path with: docker volume inspect postiz_minio-data"
  echo "  Set MINIO_VOLUME_PATH env var to the correct Mountpoint path."
}

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] MinIO sync complete: minio/minio-$DATE/"

# ── Cleanup: Remove Old Backups ──────────────────────────────────────────────
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Cleaning up backups older than $RETENTION_DAYS days..."

# Delete PostgreSQL dumps older than RETENTION_DAYS
find "$BACKUP_DIR/postgres" -name "*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

# Delete MinIO backup directories older than RETENTION_DAYS
find "$BACKUP_DIR/minio" -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" \
  -exec rm -rf {} + 2>/dev/null || true

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup complete: $DATE"
