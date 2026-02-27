import getBashTools from '@/tools/bash';
import getUtilsTools from '@/tools/utils';
import getGithubFetchTools from '@/tools/github-fetch';
import getTencentWsaTools from '@/tools/tencent-wsa';
import getComposioTools from '@/tools/composio';
import getWriteSubagentTodosTools from '@/tools/write-subagent-todos';
import getKnowledgeTools from '@/tools/knowledge';
import getLspTools from '@/tools/lsp-tools';
import getGlobTools from '@/tools/glob';
import getGrepTools from '@/tools/grep';
import getWebFetchTools from '@/tools/web-fetch';

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
  ];
}