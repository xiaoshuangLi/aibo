#!/bin/bash

# Pre-commit build script
# This script runs before each commit to ensure the code builds successfully

echo "🔍 Pre-commit build check started..."

# Run TypeScript build
echo "📦 Building TypeScript project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Please fix the errors before committing."
    exit 1
fi

echo "✅ Build successful! Ready to commit."
exit 0