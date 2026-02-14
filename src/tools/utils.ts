import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * 通用工具模块
 * 
 * 该模块提供常用的基础操作工具，包括延迟执行和回显功能。
 */

/**
 * 延迟执行工具
 * 
 * 中文名称：延迟执行工具
 * 
 * 预期行为：
 * - 接收延迟时间参数（毫秒）
 * - 暂停执行指定的毫秒数
 * - 返回包含延迟信息的成功响应
 * 
 * 行为分支：
 * 1. 正常延迟：成功暂停指定时间，返回包含延迟时长的成功消息
 * 2. 参数验证：通过Zod schema确保duration在0-10000毫秒范围内
 * 3. 零延迟：当duration为0时，立即返回成功响应
 * 4. 最大延迟：当duration为10000时，暂停10秒后返回
 * 
 * @param duration - 延迟时间（毫秒），必须是0-10000之间的整数
 * @returns Promise<string> - 包含延迟结果的JSON字符串，包含success:true和message字段
 * 
 * @example
 * ```typescript
 * // 延迟1秒
 * const result = await sleepTool.invoke({ duration: 1000 });
 * 
 * // 立即返回（零延迟）
 * const result = await sleepTool.invoke({ duration: 0 });
 * ```
 * 
 * @note
 * - 该工具主要用于测试、调试或需要精确控制执行时间的场景
 * - 实际延迟时间可能因系统调度而略有偏差
 */
export const sleepTool = tool(
  async ({ duration }) => {
    // Remove the validation from here since schema already handles it
    // The schema ensures duration is between 0 and 10000
    await new Promise(resolve => setTimeout(resolve, duration));
    
    return JSON.stringify({
      success: true,
      message: `Slept for ${duration} milliseconds`
    });
  },
  {
    name: "sleep",
    description: "Pauses execution for the specified duration in milliseconds (0-10000).",
    schema: z.object({
      duration: z.number().int().min(0).max(10000).describe("Duration to sleep in milliseconds")
    })
  }
);

/**
 * 回显工具
 * 
 * 中文名称：回显工具
 * 
 * 预期行为：
 * - 接收回显消息参数
 * - 直接返回包含原始消息的响应
 * - 不进行任何处理或修改
 * 
 * 行为分支：
 * 1. 正常回显：接收任何字符串输入，原样返回在echoed字段中
 * 2. 空字符串：可以回显空字符串
 * 3. 特殊字符：支持包含特殊字符、换行符等的字符串
 * 4. 长字符串：可以回显任意长度的字符串（受系统内存限制）
 * 
 * @param message - 要回显的消息字符串
 * @returns Promise<string> - 包含回显结果的JSON字符串，包含success:true和echoed字段
 * 
 * @example
 * ```typescript
 * // 回显简单消息
 * const result = await echoTool.invoke({ message: "Hello World" });
 * 
 * // 回显包含特殊字符的消息
 * const result = await echoTool.invoke({ message: "Test\nwith\ttabs" });
 * ```
 * 
 * @note
 * - 该工具主要用于测试、调试或需要验证消息传递的场景
 * - 不对输入进行任何验证或处理，直接返回原始输入
 */
export const echoTool = tool(
  async ({ message }) => {
    return JSON.stringify({
      success: true,
      echoed: message
    });
  },
  {
    name: "echo",
    description: "Returns the input message back to the caller.",
    schema: z.object({
      message: z.string().describe("Message to echo back")
    })
  }
);

/**
 * 异步获取通用工具的方法
 * 
 * @returns Promise<Array<any>> - 包含通用工具的数组
 */
export default async function getUtilsTools() {
  return [sleepTool, echoTool];
}