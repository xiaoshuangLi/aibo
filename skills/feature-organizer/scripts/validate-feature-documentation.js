#!/usr/bin/env node

/**
 * 阶段3验证脚本：功能文档生成验证
 * 用途：验证是否正确生成了功能文档
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 阶段3验证：功能文档生成验证');
console.log('==============================');

// 检查features目录是否存在
if (!fs.existsSync('features')) {
    console.error('❌ 错误：未找到 features 目录');
    process.exit(1);
}

// 查找最新生成的功能文档
const featureFiles = fs.readdirSync('features')
    .filter(file => file.endsWith('.md'))
    .sort();

if (featureFiles.length === 0) {
    console.error('❌ 错误：未找到任何功能文档文件');
    console.error('   请确保在阶段3中生成了功能文档');
    process.exit(1);
}

const latestFeature = path.join('features', featureFiles[featureFiles.length - 1]);
console.log(`📄 最新功能文档: ${latestFeature}`);

// 检查文档是否包含必需的章节
const requiredSections = [
    '## 📋 Specification (规格说明)',
    '## 🏗️ Technical Design (技术设计)',
    '## 📝 Implementation Plan (实施计划)',
    '## 🚀 Usage Guide (使用指南)',
    '## 📊 Impact Analysis (影响分析)'
];
const featureContent = fs.readFileSync(latestFeature, 'utf8');

const missingSections = [];
for (const section of requiredSections) {
    if (!featureContent.includes(section)) {
        // 提取章节名称用于错误显示（去掉##和emoji）
        const sectionName = section.replace(/^##\s*[^\s]+\s*/, '');
        missingSections.push(sectionName);
    }
}

if (missingSections.length === 0) {
    console.log('✅ 所有必需的章节都已包含');
} else {
    console.error('⚠️  缺少以下章节：');
    missingSections.forEach(section => {
        console.error(`   - ${section}`);
    });
    console.error('   请确保功能文档包含所有必需的章节');
    process.exit(1);
}

// 检查文件命名是否符合规范 (###-feature-name.md)
const filename = path.basename(latestFeature);
const namingPattern = /^[0-9]{3}-[a-z0-9-]+\.md$/;
if (namingPattern.test(filename)) {
    console.log(`✅ 文件命名符合规范: ${filename}`);
} else {
    console.error(`⚠️  文件命名不符合规范: ${filename}`);
    console.error('   请使用格式: ###-feature-name.md (例如: 043-path-alias-conversion.md)');
    process.exit(1);
}

// 检查序列号是否连续
const currentNumber = parseInt(filename.split('-')[0], 10);
if (featureFiles.length > 1) {
    const previousFile = featureFiles[featureFiles.length - 2];
    const lastNumber = parseInt(previousFile.split('-')[0], 10);
    const expectedNumber = lastNumber + 1;
    
    if (currentNumber === expectedNumber) {
        console.log(`✅ 序列号连续: ${currentNumber.toString().padStart(3, '0')}`);
    } else {
        console.error(`⚠️  序列号不连续: 当前 ${currentNumber.toString().padStart(3, '0')}, 期望 ${expectedNumber.toString().padStart(3, '0')}`);
        console.error('   请检查 features 目录中的文件编号');
        process.exit(1);
    }
}

console.log('🎉 阶段3验证通过！');
process.exit(0);