#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 覆盖率阈值 (85%)
const COVERAGE_THRESHOLD = 85;

// 读取 coverage-final.json 文件
const coveragePath = path.join(__dirname, '..', 'coverage', 'coverage-final.json');

if (!fs.existsSync(coveragePath)) {
  console.error('❌ Coverage report not found at:', coveragePath);
  console.error('Please run "npm run test:coverage" first to generate coverage report.');
  process.exit(1);
}

try {
  const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  
  // 计算总覆盖率
  let totalStatements = 0;
  let coveredStatements = 0;
  
  for (const file in coverageData) {
    const fileData = coverageData[file];
    const statements = fileData.s || {};
    
    for (const line in statements) {
      totalStatements++;
      if (statements[line] > 0) {
        coveredStatements++;
      }
    }
  }
  
  const coveragePercentage = totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0;
  
  console.log(`📊 Total statement coverage: ${coveragePercentage.toFixed(2)}%`);
  console.log(`🎯 Required threshold: ${COVERAGE_THRESHOLD}%`);
  
  if (coveragePercentage < COVERAGE_THRESHOLD) {
    console.error(`❌ Coverage (${coveragePercentage.toFixed(2)}%) is below the required threshold (${COVERAGE_THRESHOLD}%)!`);
    console.error('Please add more tests to improve coverage before committing.');
    process.exit(1);
  } else {
    console.log(`✅ Coverage (${coveragePercentage.toFixed(2)}%) meets the required threshold (${COVERAGE_THRESHOLD}%)!`);
    process.exit(0);
  }
  
} catch (error) {
  console.error('❌ Error reading coverage data:', error.message);
  process.exit(1);
}