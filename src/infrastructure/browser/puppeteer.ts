import puppeteer, { Browser, Page } from 'puppeteer';

// 浏览器实例缓存，用于生产环境复用
let cachedBrowser: Browser | null = null;

/**
 * 创建Puppeteer浏览器实例
 * 
 * 中文名称：创建Puppeteer浏览器实例
 * 
 * 预期行为：
 * - 在测试环境中每次都创建新实例以避免状态污染
 * - 在生产环境中复用缓存的浏览器实例以提高性能
 * - 使用无头模式启动浏览器
 * - 应用反检测参数以绕过自动化检测
 * - 支持自定义启动选项
 * 
 * 行为分支：
 * 1. 测试环境（NODE_ENV=test）：总是创建新浏览器实例，不使用缓存
 * 2. 生产环境且有缓存：直接返回缓存的浏览器实例
 * 3. 生产环境且无缓存：创建新浏览器实例并缓存
 * 4. 启动参数：应用默认的反检测参数，并合并用户提供的选项
 * 
 * @param options - 可选的Puppeteer启动选项，会与默认选项合并
 * @returns Promise<Browser> - Puppeteer浏览器实例的Promise
 * 
 * @example
 * ```typescript
 * // 创建默认浏览器实例
 * const browser = await createBrowser();
 * 
 * // 创建带自定义选项的浏览器实例
 * const browser = await createBrowser({ headless: false });
 * ```
 * 
 * @note
 * - 默认启用无头模式（headless: true）
 * - 应用反自动化检测参数以提高成功率
 * - 生产环境中实例会被缓存以提高性能
 */
export async function createBrowser(options: any = {}): Promise<Browser> {
  // 在测试环境中不使用缓存（通过环境变量判断）
  const isTest = process.env.NODE_ENV === 'test';
  
  if (!isTest && cachedBrowser) {
    return cachedBrowser;
  }

  const browser = await puppeteer.launch({
    headless: true, // 生产环境使用无头模式
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
    ...options
  });

  if (!isTest) {
    cachedBrowser = browser;
  }

  return browser;
}

/**
 * 关闭Puppeteer浏览器实例
 * 
 * 中文名称：关闭Puppeteer浏览器实例
 * 
 * 预期行为：
 * - 检查是否存在缓存的浏览器实例
 * - 如果存在，关闭浏览器实例并清除缓存
 * - 忽略关闭过程中可能发生的错误
 * 
 * 行为分支：
 * 1. 有缓存实例：关闭浏览器并设置cachedBrowser为null
 * 2. 无缓存实例：直接返回，不执行任何操作
 * 3. 关闭失败：捕获并忽略错误，仍清除缓存
 * 
 * @returns Promise<void> - 无返回值的Promise
 * 
 * @example
 * ```typescript
 * // 关闭浏览器实例（主要用于测试环境清理）
 * await closeBrowser();
 * ```
 * 
 * @note
 * - 主要用于测试环境的清理工作
 * - 生产环境中通常不需要手动调用此函数
 * - 错误会被静默忽略以确保缓存被清除
 */
export async function closeBrowser(): Promise<void> {
  if (cachedBrowser) {
    await cachedBrowser.close().catch(() => {});
    cachedBrowser = null;
  }
}

// ======================
// 通用文本提取（优化版）
// ======================

/**
 * 处理页面内容提取的错误
 * 
 * 中文名称：处理页面内容提取错误
 * 
 * 预期行为：
 * - 统一处理各种错误情况
 * - 记录错误日志
 * - 抛出标准化的错误信息
 * 
 * @param error - 原始错误对象
 * @param context - 错误上下文信息
 * @throws {Error} 抛出标准化的错误
 */
function handleExtractionError(error: unknown, context: string): never {
  const msg = error instanceof Error ? error.message : String(error);
  console.error('❌ 错误:', msg);
  throw new Error(`获取页面文本失败: ${msg}`);
}

/**
 * 从URL提取纯文本内容
 * 
 * 中文名称：从URL提取纯文本内容
 * 
 * 预期行为：
 * - 使用Puppeteer浏览器访问指定URL
 * - 等待页面完全加载（networkidle0状态）
 * - 执行客户端JavaScript提取和格式化页面内容
 * - 移除无用的HTML元素（脚本、样式、iframe等）
 * - 保留有用的页面结构（标题、列表、链接）
 * - 返回格式化的纯文本内容
 * 
 * 行为分支：
 * 1. 正常提取：成功访问页面并返回格式化文本
 * 2. 页面加载失败：HTTP状态码>=400，抛出错误
 * 3. 网络错误：连接超时或DNS解析失败，抛出错误
 * 4. 测试环境：每次创建新浏览器实例并在完成后关闭
 * 5. 生产环境：复用缓存的浏览器实例
 * 6. 内容处理：保留标题层级、列表结构，提取并格式化链接
 * 7. 链接限制：最多提取200个链接以防止内存问题
 * 
 * @param url - 要提取内容的URL字符串
 * @returns Promise<string> - 格式化后的纯文本内容Promise
 * 
 * @example
 * ```typescript
 * // 提取网页内容
 * const content = await getTextFromUrl("https://example.com");
 * ```
 * 
 * @note
 * - 使用真实浏览器绕过反爬虫措施
 * - 支持JavaScript渲染的动态网站
 * - 自动处理页面结构，保留重要信息
 * - 包含详细的链接参考信息
 */
export async function getTextFromUrl(url: string): Promise<string> {
  let page: Page | null = null;
  let browser: Browser | null = null;
  let shouldCloseBrowser = false;

  try {
    // 在测试环境中每次都创建新浏览器实例
    const isTest = process.env.NODE_ENV === 'test';
    browser = await createBrowser();
    shouldCloseBrowser = isTest;

    page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });

    console.log(`🔍 访问: ${url}`);
    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    if (!response || response.status() >= 400) {
      const status = response?.status() || '无响应';
      handleExtractionError(new Error(`页面加载失败，状态码: ${status} - ${url}`), 'page_load');
    }

    // 直接提取整个页面文本
    const text = await page.evaluate(() => {
      const preserveHeadings = true;
      const preserveLists = true;
      const maxLinkCount = 200;
      
      const tempDiv = document.body;
      
      // 移除无用元素
      const removeElements = tempDiv.querySelectorAll(
        'script, style, noscript, iframe, svg, canvas, meta, link'
      );
      removeElements.forEach(el => el.remove());
      
      // 提取链接
      const links: { text: string; href: string; title?: string }[] = [];
      const linkElements = Array.from(tempDiv.querySelectorAll('a[href]'));
      
      linkElements.slice(0, maxLinkCount).forEach((link, index) => {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.trim() || '';
        const title = link.getAttribute('title') || undefined;
        
        if (text && href) {
          links.push({ text, href, title });
          link.innerHTML = `[🔗${index + 1}]`;
        }
      });
      
      // 保留标题结构
      if (preserveHeadings) {
        const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach(heading => {
          const level = parseInt(heading.tagName[1]);
          const prefix = '#'.repeat(level) + ' ';
          heading.innerHTML = prefix + heading.innerHTML;
        });
      }
      
      // 保留列表结构
      if (preserveLists) {
        const lists = tempDiv.querySelectorAll('ul, ol');
        lists.forEach(list => {
          const isOrdered = list.tagName === 'OL';
          let counter = 1;
          
          const items = list.querySelectorAll('li');
          items.forEach(item => {
            const prefix = isOrdered ? `${counter}. ` : '• ';
            item.innerHTML = prefix + item.innerHTML;
            counter++;
          });
        });
      }

      // 处理换行和格式
      let content = tempDiv.innerHTML;
      
      // 转换 HTML 标签为文本格式
      content = content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, '') // 移除所有 HTML 标签
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .replace(/^\s+|\s+$/g, '');
      
      // 添加链接信息
      if (links.length > 0) {
        content += '\n\n---\n📋 **参考链接：**\n';
        links.forEach((link, index) => {
          content += `\n[${index + 1}] ${link.text}`;
          if (link.title) {
            content += ` (${link.title})`;
          }
          content += `\n   🌐 ${link.href}\n`;
        });
      }
      
      return content;
    });

    console.log(`✅ 成功提取 ${text.length} 个字符`);

    return text;
  } catch (error) {
    handleExtractionError(error, 'content_extraction');
    throw error;
  } finally {
    // 关闭页面
    if (page) {
      await page.close().catch(() => {});
    }
    
    // 在测试环境中关闭浏览器
    if (shouldCloseBrowser && browser) {
      await browser.close().catch(() => {});
    }
  }
}