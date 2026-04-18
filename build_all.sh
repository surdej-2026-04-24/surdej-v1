#!/bin/bash
for app in apps/api apps/frontend workers/analyze workers/document workers/knowledge workers/laka-dispatch workers/pdf-refinery workers/sharepoint-ingest; do
  echo "Building $app..."
  docker build -t test-$(basename $app) -f $app/Dockerfile .
  if [ $? -ne 0 ]; then
    echo "FAILED: $app"
    exit 1
  fi
done
echo "ALL BUILDS SUCCESSFUL"
