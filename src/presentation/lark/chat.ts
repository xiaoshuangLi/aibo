/**
 * 飞书(Lark)群聊服务 - 管理工作目录对应的群聊以及素材上传
 *
 * 中文名称：飞书群聊服务
 *
 * 负责创建和复用与当前执行命令目录绑定的飞书群聊，
 * 以及通过云文档/多维表格实现图片素材的上传与临时下载链接获取。
 *
 * @module chat
 */

import * as lark from '@larksuiteoapi/node-sdk';
import { config } from '@/core/config';

/**
 * Detect image file extension from buffer magic bytes.
 * Falls back to 'png' if format cannot be determined.
 */
function detectImageExtension(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return "png";
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
  ) {
    return "gif";
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return "webp";
  }
  return "png";
}

/** 飞书图片下载 API 响应体（BinaryResponseBody）结构 */
interface LarkImageResponse {
  /** 图片二进制数据 */
  data: Buffer;
}

/** 根据工作目录生成用于标识群聊的描述标记，格式如：【`/path/to/cwd`】 */
const getChatDescriptionMarker = (cwd: string): string => `【\`${cwd}\`】`;

/**
 * 飞书群聊服务
 */
export class LarkChatService {
  private client: lark.Client;

  // 素材多维表格 app_token 缓存，避免重复查找/创建
  private bitableToken: string | null = null;

  constructor() {
    const { appId, appSecret } = config.lark;
    if (!appId || !appSecret) {
      throw new Error('Missing required Lark environment variables: AIBO_LARK_APP_ID and AIBO_LARK_APP_SECRET');
    }
    this.client = new lark.Client({
      appId,
      appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    });
  }

  /**
   * 获取或创建与当前工作目录绑定的群聊，返回群聊 chat_id。
   */
  async getOrCreateChat(): Promise<string> {
    const cwd = process.cwd();
    const folderName = cwd.split('/').pop() || 'aibo-project';
    const { appId, receiveId } = config.lark;

    if (!receiveId) {
      throw new Error('Missing required Lark config: AIBO_LARK_RECEIVE_ID');
    }
    if (!appId) {
      throw new Error('Missing required Lark config: AIBO_LARK_APP_ID');
    }

    // 1. 通过描述查找已有群聊（仍然使用完整路径作为唯一标识）
    const existingChatId = await this.findChatByDescription(cwd);
    if (existingChatId) {
      console.log(`✅ 找到已有群聊: ${existingChatId}，跳过创建`);
      return existingChatId;
    }

    // 2. 创建群聊（群聊名称使用文件夹名，但描述中仍包含完整路径作为标识）
    const chatId = await this.createChat(folderName, cwd, receiveId, appId);

    return chatId;
  }

  /**
   * 遍历机器人所在的所有群聊，查找描述中包含 【`${cwd}`】 标记的群聊。
   * 返回匹配的 chat_id，未找到则返回 null。
   */
  private async findChatByDescription(cwd: string): Promise<string | null> {
    let pageToken: string | undefined;

    do {
      const resp = await (this.client.im.chat as any).list({
        params: {
          page_size: 100,
          ...(pageToken ? { page_token: pageToken } : {}),
        },
      });

      const items: Array<{ chat_id: string; description?: string }> = resp?.data?.items ?? [];
      for (const item of items) {
        const desc = item.description ?? '';
        if (desc.includes(getChatDescriptionMarker(cwd))) {
          return item.chat_id;
        }
      }

      pageToken = resp?.data?.has_more ? resp?.data?.page_token : undefined;
    } while (pageToken);

    return null;
  }

  /**
   * 创建飞书群聊，返回 chat_id。
   */
  private async createChat(name: string, cwd: string, receiveId: string, botId: string): Promise<string> {
    // `as any` is required because the Lark Node SDK types do not yet expose
    // all fields for the chat create request (e.g. bot_id_list, restricted_mode_setting).
    const resp = await (this.client.im.chat as any).create({
      data: {
        name,
        description: `aibo 工作目录: ${cwd} ${getChatDescriptionMarker(cwd)}`,
        owner_id: receiveId,
        user_id_list: [receiveId],
        bot_id_list: [botId],
        group_message_type: 'chat',
        chat_mode: 'group',
        chat_type: 'private',
        join_message_visibility: 'all_members',
        leave_message_visibility: 'all_members',
        membership_approval: 'no_approval_required',
        restricted_mode_setting: {
          status: false,
          screenshot_has_permission_setting: 'all_members',
          download_has_permission_setting: 'all_members',
          message_has_permission_setting: 'all_members',
        },
        urgent_setting: 'all_members',
        video_conference_setting: 'all_members',
        edit_permission: 'all_members',
        hide_member_count_setting: 'all_members',
      },
      params: {
        user_id_type: 'user_id',
      },
    });

    const chatId: string | undefined = resp?.data?.chat_id;
    if (!chatId) {
      throw new Error(`创建群聊失败，响应: ${JSON.stringify(resp)}`);
    }

    console.log(`💬 创建群聊成功 chat_id=${chatId}`);
    return chatId;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 素材上传：创建文件夹、多维表格、上传文件、获取下载地址
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 通过消息 ID 和 image_key 从飞书消息中下载图片，返回图片二进制数据（Buffer）。
   * 使用 im.v1.messageResource.get 接口，file_key 即消息内容里的 image_key。
   */
  async downloadImage(messageId: string, imageKey: string): Promise<Buffer> {
    const res = await (this.client as any).im.v1.messageResource.get({
      path: {
        message_id: messageId,
        file_key: imageKey,
      },
      params: {
        type: 'image',
      },
    });

    const readableStream = res.getReadableStream();
    const chunks = [];

    for await (const chunk of readableStream) {
        chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    if (!buffer) {
      throw new Error(`下载图片失败，message_id: ${messageId}, image_key: ${imageKey}`);
    }
    return buffer;
  }

  /**
   * 上传 base64 编码的图片，返回素材临时下载地址。
   *
   * 流程：
   * 1. 查找或创建「素材库」文件夹
   * 2. 在文件夹内查找或创建「素材多维表格」多维表格（app_token 缓存，避免重复创建）
   * 3. 将图片上传到多维表格，获取 fileToken
   * 4. 获取素材临时下载链接并返回
   */
  async uploadImage(base64: string): Promise<string> {
    if (!this.bitableToken) {
      const folderToken = await this.getOrCreateAssetLibraryFolder();
      this.bitableToken = await this.getOrCreateAssetBitable(folderToken);
    }

    const fileToken = await this.uploadImageToBitable(base64, this.bitableToken);
    return this.getTmpDownloadUrl(fileToken);
  }

  /**
   * 在根目录中查找名为「素材库」的文件夹；如果不存在则创建。
   * 返回文件夹的 token。
   */
  private async getOrCreateAssetLibraryFolder(): Promise<string> {
    const FOLDER_NAME = '【素材库】';
    let pageToken: string | undefined;

    do {
      const resp = await (this.client.drive.v1.file as any).list({
        params: {
          page_size: 200,
          ...(pageToken ? { page_token: pageToken } : {}),
        },
      });

      const files: Array<{ token: string; name: string; type: string }> = resp?.data?.files ?? [];
      for (const file of files) {
        if (file.type === 'folder' && file.name === FOLDER_NAME) {
          return file.token;
        }
      }

      pageToken = resp?.data?.has_more ? resp?.data?.next_page_token : undefined;
    } while (pageToken);

    // 未找到，创建新文件夹
    const createResp = await (this.client.drive.v1.file as any).createFolder({
      data: {
        name: FOLDER_NAME,
        folder_token: '',
      },
    });

    const token: string | undefined = createResp?.data?.token;
    if (!token) {
      throw new Error(`创建「${FOLDER_NAME}」文件夹失败，响应: ${JSON.stringify(createResp)}`);
    }
    return token;
  }

  /**
   * 在指定文件夹中查找名为「素材多维表格」的多维表格；如果不存在则创建。
   * 返回多维表格的 app_token。
   */
  private async getOrCreateAssetBitable(folderToken: string): Promise<string> {
    const BITABLE_NAME = '【素材多维表格】';
    let pageToken: string | undefined;

    do {
      const resp = await (this.client.drive.v1.file as any).list({
        params: {
          page_size: 200,
          folder_token: folderToken,
          ...(pageToken ? { page_token: pageToken } : {}),
        },
      });

      const files: Array<{ token: string; name: string; type: string }> = resp?.data?.files ?? [];
      for (const file of files) {
        if (file.type === 'bitable' && file.name === BITABLE_NAME) {
          return file.token;
        }
      }

      pageToken = resp?.data?.has_more ? resp?.data?.next_page_token : undefined;
    } while (pageToken);

    // 未找到，创建新多维表格
    const createResp = await (this.client.bitable.v1.app as any).create({
      data: {
        name: BITABLE_NAME,
        folder_token: folderToken,
      },
    });

    const appToken: string | undefined = createResp?.data?.app?.app_token;
    if (!appToken) {
      throw new Error(`创建「${BITABLE_NAME}」多维表格失败，响应: ${JSON.stringify(createResp)}`);
    }
    return appToken;
  }

  /**
   * 将 base64 编码的图片上传到指定多维表格，返回 fileToken。
   */
  private async uploadImageToBitable(base64: string, appToken: string): Promise<string> {
    const imageBuffer = Buffer.from(base64, 'base64');
    const ext = detectImageExtension(imageBuffer);
    const fileName = `image_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const resp = await (this.client.drive.v1.media as any).uploadAll({
      data: {
        file_name: fileName,
        parent_type: 'bitable_file',
        parent_node: appToken,
        size: imageBuffer.length,
        file: imageBuffer,
      },
    });

    const fileToken: string | undefined = resp?.file_token;
    if (!fileToken) {
      throw new Error(`上传图片到多维表格失败，响应: ${JSON.stringify(resp)}`);
    }
    return fileToken;
  }

  /**
   * 通过 fileToken 获取素材临时下载链接。
   */
  private async getTmpDownloadUrl(fileToken: string): Promise<string> {
    const resp = await (this.client.drive.v1.media as any).batchGetTmpDownloadUrl({
      params: {
        file_tokens: [fileToken],
      },
    });

    const urls: Array<{ file_token: string; tmp_download_url: string }> = resp?.data?.tmp_download_urls ?? [];
    const entry = urls.find(u => u.file_token === fileToken);
    if (!entry?.tmp_download_url) {
      throw new Error(`获取素材临时下载链接失败，响应: ${JSON.stringify(resp)}`);
    }
    return entry.tmp_download_url;
  }
}
