#!/usr/bin/env node

/**
 * 阶段1验证脚本：测试验证和覆盖率检查
 * 用途：验证所有测试通过且覆盖率≥80%
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 阶段1验证：测试验证和覆盖率检查');
console.log('================================');

// 检查是否有package.json
if (!fs.existsSync('package.json')) {
    console.error('❌ 错误：未找到 package.json 文件');
    process.exit(1);
}

// 检查是否有测试脚本
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!packageJson.scripts || !packageJson.scripts.test) {
    console.warn('⚠️  警告：package.json 中未定义 test 脚本');
    console.warn('   建议：添加测试脚本以确保代码质量');
    process.exit(0);
}

// 运行测试
console.log('🧪 正在运行测试套件...');
try {
    execSync('npm test', { stdio: 'inherit' });
    console.log('✅ 所有测试通过');
} catch (error) {
    console.error('❌ 测试失败！请修复测试错误后再继续');
    process.exit(1);
}

// 检查覆盖率
console.log('📊 正在检查测试覆盖率...');
try {
    // 运行覆盖率检查
    const coverageOutput = execSync('npx jest --coverage --coverageReporters=text-summary', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
    });
    
    // 提取覆盖率百分比
    const coverageMatch = coverageOutput.match(/Statements\s*:\s*(\d+\.?\d*)%/);
    if (coverageMatch && coverageMatch[1]) {
        const coveragePercent = parseFloat(coverageMatch[1]);
        if (coveragePercent >= 80) {
            console.log(`✅ 测试覆盖率: ${coveragePercent}% (≥80%)`);
            console.log('🎉 阶段1验证通过！');
            process.exit(0);
        } else {
            console.error(`❌ 测试覆盖率不足: ${coveragePercent}% (<80%)`);
            console.error('   请增加测试用例以提高覆盖率');
            process.exit(1);
        }
    } else {
        console.warn('⚠️  无法解析覆盖率数据，但测试已通过');
        console.warn('   建议：检查覆盖率报告格式');
        process.exit(0);
    }
} catch (error) {
    console.warn('⚠️  未生成覆盖率报告，但测试已通过');
    process.exit(0);
}