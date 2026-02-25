import getBashTools from '@/tools/bash';
import getUtilsTools from '@/tools/utils';
import getGithubFetchTools from '@/tools/github-fetch';
import getTencentWsaTools from '@/tools/tencent-wsa';
import getComposioTools from '@/tools/composio';
import getWriteSubagentTodosTools from '@/tools/write-subagent-todos';
import getKnowledgeTools from '@/tools/knowledge';
import getLspTools from '@/tools/lsp-tools';

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
  ] = await Promise.all([
    getBashTools(),
    getUtilsTools(),
    getGithubFetchTools(),
    getTencentWsaTools(),
    getComposioTools(),
    getWriteSubagentTodosTools(),
    getKnowledgeTools(),
    getLspTools(),
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
  ];
}