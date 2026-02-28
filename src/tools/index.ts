import getBashTools from '@/tools/bash';
import getUtilsTools from '@/tools/utils';
import getGithubFetchTools from '@/tools/github-fetch';
import getTencentWsaTools from '@/tools/tencent-wsa';
import getComposioTools from '@/tools/composio';
import getWriteSubagentTodosTools from '@/tools/write-subagent-todos';
import getKnowledgeTools from '@/tools/knowledge';
import getLspTools from '@/tools/lsp';
import getGlobTools from '@/tools/glob';
import getGrepTools from '@/tools/grep';
import getWebFetchTools from '@/tools/web-fetch';
import getViewFileTools from '@/tools/view-file';
import getEditFileTools from '@/tools/edit-file';
import getThinkTools from '@/tools/think';
import getWriteFileTools from '@/tools/write-file';
import getTodoTools from '@/tools/todo';
import getClaudeTools from '@/tools/claude';
import getCursorTools from '@/tools/cursor';
import getGeminiTools from '@/tools/gemini';
import getCodexTools from '@/tools/codex';

/**
 * 异步获取所有工具的方法
 * 
 * @returns Promise<Array<any>> - 包含所有工具的数组
 */
export default async function getTools() {
  const [
    bashTools,
    utilsTools,
    githubFetchTools,
    tencentWsaTools,
    composioTools,
    writeSubagentTodosTools,
    knowledgeTools,
    lspTools,
    globTools,
    grepTools,
    webFetchTools,
    viewFileTools,
    editFileTools,
    thinkTools,
    writeFileTools,
    todoTools,
    claudeTools,
    cursorTools,
    geminiTools,
    codexTools,
  ] = await Promise.all([
    getBashTools(),
    getUtilsTools(),
    getGithubFetchTools(),
    getTencentWsaTools(),
    getComposioTools(),
    getWriteSubagentTodosTools(),
    getKnowledgeTools(),
    getLspTools(),
    getGlobTools(),
    getGrepTools(),
    getWebFetchTools(),
    getViewFileTools(),
    getEditFileTools(),
    getThinkTools(),
    getWriteFileTools(),
    getTodoTools(),
    getClaudeTools(),
    getCursorTools(),
    getGeminiTools(),
    getCodexTools(),
  ]);
  
  return [
    ...bashTools,
    ...utilsTools,
    ...githubFetchTools,
    ...tencentWsaTools,
    ...composioTools,
    ...writeSubagentTodosTools,
    ...knowledgeTools,
    ...lspTools,
    ...globTools,
    ...grepTools,
    ...webFetchTools,
    ...viewFileTools,
    ...editFileTools,
    ...thinkTools,
    ...writeFileTools,
    ...todoTools,
    ...claudeTools,
    ...cursorTools,
    ...geminiTools,
    ...codexTools,
  ];
}
