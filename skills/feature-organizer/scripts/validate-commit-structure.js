#!/usr/bin/env node

/**
 * 阶段4验证脚本：提交结构验证
 * 用途：验证是否创建了干净、结构良好的提交
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 阶段4验证：提交结构验证');
console.log('==========================');

// 检查工作目录是否干净
let workingDirectoryClean = false;
try {
    execSync('git diff --quiet');
    execSync('git diff --cached --quiet');
    workingDirectoryClean = true;
    console.log('✅ 工作目录干净，所有更改已提交');
} catch (error) {
    console.log('⚠️  工作目录不干净，存在未提交的更改');
    console.log('   请确保所有更改都已正确提交');
    
    // 显示未提交的更改
    try {
        const uncommittedChanges = execSync('git diff --name-only', { encoding: 'utf8' }).trim();
        if (uncommittedChanges) {
            console.log('📋 未提交的文件：');
            console.log(uncommittedChanges);
        }
        
        const uncommittedStaged = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim();
        if (uncommittedStaged) {
            console.log('📋 未提交的暂存文件：');
            console.log(uncommittedStaged);
        }
    } catch (e) {
        // Ignore
    }
    
    process.exit(1);
}

// 检查最近的提交是否包含功能文档
try {
    const lastCommitFiles = execSync('git show --name-only --format="" HEAD', { encoding: 'utf8' }).trim();
    if (lastCommitFiles.includes('features/')) {
        console.log('✅ 最近的提交包含功能文档');
    } else {
        console.warn('⚠️  最近的提交可能不包含功能文档');
        console.warn('   请确保功能文档已包含在提交中');
    }
} catch (error) {
    console.warn('⚠️  无法检查最近的提交内容');
}

// 检查提交信息格式
try {
    const commitMessage = execSync('git log -1 --format=%s', { encoding: 'utf8' }).trim();
    console.log(`📝 最近提交信息: ${commitMessage}`);
    
    // 检查是否符合常规提交格式
    const conventionalCommitPattern = /^(feat|fix|docs|style|refactor|perf|test|chore)(\(.+\))?: .+/;
    if (conventionalCommitPattern.test(commitMessage)) {
        console.log('✅ 提交信息符合常规提交格式');
    } else {
        console.warn('⚠️  提交信息可能不符合常规提交格式');
        console.warn('   建议格式: type(scope): description');
    }
} catch (error) {
    console.warn('⚠️  无法检查提交信息格式');
}

// 验证最终状态
if (workingDirectoryClean) {
    console.log('🎉 阶段4验证通过！提交结构良好');
    process.exit(0);
} else {
    console.error('❌ 阶段4验证失败：工作目录不干净');
    process.exit(1);
}