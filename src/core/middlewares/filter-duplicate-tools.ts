import { createMiddleware } from 'langchain';
import { z } from 'zod';

/**
 * FilterDuplicateToolsMiddleware
 * 作用：在模型调用前过滤掉重复定义的工具，确保传给 LLM 的工具集是唯一的。
 */
export function createFilterDuplicateToolsMiddleware() {
  return createMiddleware({
    name: 'FilterDuplicateToolsMiddleware',

    // 状态架构（如果不需要存储状态，保持为空）
    stateSchema: z.object({}),

    /**
     * wrapModelCall 允许我们在请求发送给 LLM 之前修改参数
     */
    wrapModelCall: async (request, handler) => {
      // 1. 检查请求中是否有工具定义
      if (!request.tools || request.tools.length === 0) {
        return handler(request);
      }

      // 2. 执行去重逻辑
      const seenNames = new Set<string>();
      const uniqueTools = request.tools.filter((tool) => {
        // DeepAgentsJS 的工具通常在 tool.type === 'function' 下的 function.name
        const name = tool?.name as any;
        if (!name) return true; // 如果没有名字（异常情况），保留

        if (seenNames.has(name)) {
          return false;
        }

        seenNames.add(name);
        return true;
      });

      // 3. 将清理后的工具列表传给后续处理器
      return handler({
        ...request,
        tools: uniqueTools,
      });
    },
  });
}
