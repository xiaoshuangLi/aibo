import getBashTools from '@/tools/bash';
import getUtilsTools from '@/tools/utils';
import getGithubFetchTools from '@/tools/github-fetch';
import getTencentWsaTools from '@/tools/tencent-wsa';
import getHybridCodeReaderTools from '@/tools/hybrid-code-reader';
import getComposioTools from '@/tools/composio';
import getWriteSubagentTodosTools from '@/tools/write-subagent-todos';
import getKnowledgeTools from '@/tools/knowledge';

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
    hybridCodeReaderTools,
    composioTools,
    writeSubagentTodosTools,
    knowledgeTools,
  ] = await Promise.all([
    getBashTools(),
    getUtilsTools(),
    getGithubFetchTools(),
    getTencentWsaTools(),
    getHybridCodeReaderTools(),
    getComposioTools(),
    getWriteSubagentTodosTools(),
    getKnowledgeTools(),
  ]);
  
  return [
    ...bashTools,
    ...utilsTools,
    ...githubFetchTools,
    ...tencentWsaTools,
    ...hybridCodeReaderTools,
    ...composioTools,
    ...writeSubagentTodosTools,
    ...knowledgeTools,
  ];
}