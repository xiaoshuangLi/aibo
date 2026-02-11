import puppeteer, { Browser, Page } from 'puppeteer';

// 浏览器实例缓存，用于生产环境复用
let cachedBrowser: Browser | null = null;

/**
 * 创建或获取浏览器实例
 * 在测试环境中，每次调用都会创建新实例以避免状态污染
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
 * 关闭浏览器实例（主要用于测试环境清理）
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
      throw new Error(`页面加载失败，状态码: ${response?.status() || '无响应'} - ${url}`);
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
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ 错误:', msg);
    throw new Error(`获取页面文本失败: ${msg}`);
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

/**
 * 执行 Bing 搜索，返回结果页纯文本
 */
export async function bingSearch(keyword: string): Promise<string> {
  const encoded = encodeURIComponent(keyword.trim());
  const url = `https://www.bing.com/search?q=${encoded}`;
  return getTextFromUrl(url);
}
