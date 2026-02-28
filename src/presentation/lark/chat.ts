/**
 * 飞书(Lark)群聊服务 - 管理工作目录对应的群聊
 *
 * 中文名称：飞书群聊服务
 *
 * 负责创建和复用与当前执行命令目录绑定的飞书群聊。
 * 通过群聊描述中是否包含 【`${cwd}`】 来判断是否已创建过对应群聊。
 *
 * 流程：
 * 1. 获取机器人所在的所有群列表
 * 2. 通过描述中包含 【`${cwd}`】 查找已有群聊
 * 3. 如果群聊存在，直接复用
 * 4. 如果不存在，创建群聊（描述中包含 【`${cwd}`】）
 *
 * @module chat
 */

import * as lark from '@larksuiteoapi/node-sdk';
import { config } from '@/core/config';

/** 根据工作目录生成用于标识群聊的描述标记，格式如：【`/path/to/cwd`】 */
const getChatDescriptionMarker = (cwd: string): string => `【\`${cwd}\`】`;

/**
 * 飞书群聊服务
 */
export class LarkChatService {
  private client: lark.Client;

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
}
