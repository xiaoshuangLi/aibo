#!/usr/bin/env node

/**
 * 阶段2验证脚本：从未提交更改中提取需求
 * 用途：验证是否正确识别了未提交的代码更改并提取了需求
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 阶段2验证：从未提交更改中提取需求');
console.log('================================');

// 检查是否有未提交的更改
let hasUncommittedChanges = false;
try {
    execSync('git diff --quiet');
    console.log('⚠️  未检测到未提交的代码更改');
    console.log('   如果这是预期的，请继续到阶段3');
    console.log('   如果不是预期的，请检查是否有未提交的更改');
    process.exit(0);
} catch (error) {
    hasUncommittedChanges = true;
    console.log('✅ 检测到未提交的代码更改');
    
    // 获取修改的文件列表
    const modifiedFiles = execSync('git diff --name-only', { encoding: 'utf8' }).trim();
    console.log('📋 修改的文件列表：');
    console.log(modifiedFiles);
}

const requirementsFile = 'temp_requirements.txt';
if (!fs.existsSync(requirementsFile)) {
    console.error('❌ 错误：未找到需求提取文件 (temp_requirements.txt)');
    console.error('   请确保在阶段2中生成了需求提取文件');
    process.exit(1);
}
console.log(`✅ 找到需求提取文件: ${requirementsFile}`);
const requirementsContent = fs.readFileSync(requirementsFile, 'utf8');
console.log('📄 需求内容预览：');
console.log(requirementsContent.split('\n').slice(0, 10).join('\n'));
if (requirementsContent.split('\n').length > 10) {
    console.log('...');
}

// 检查需求文件是否包含用户故事格式
const userStoryPattern = /As a.*I want.*so that/i;
if (userStoryPattern.test(requirementsContent)) {
    console.log('✅ 需求文件包含正确的用户故事格式');
    console.log('🎉 阶段2验证通过！');
    process.exit(0);
} else {
    console.warn('⚠️  需求文件可能缺少标准的用户故事格式');
    console.warn('   建议：确保需求以 \'As a [user role], I want [feature] so that [business value]\' 格式编写');
    process.exit(0);
}