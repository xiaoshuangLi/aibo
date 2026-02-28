/**
 * 飞书(Lark)群聊服务 - 管理工作目录对应的群聊
 *
 * 中文名称：飞书群聊服务
 *
 * 负责创建和复用与当前执行命令目录绑定的飞书群聊。
 * 使用标签(Tag)机制避免在同一目录下重复创建群聊。
 *
 * 流程：
 * 1. 通过标签名称（工作目录路径）查询已有标签
 * 2. 如果标签存在，通过标签绑定关系查找已绑定的群聊
 * 3. 如果群聊存在，直接复用
 * 4. 如果不存在，创建群聊 → 创建/复用标签 → 绑定标签到群聊 → 更新群公告
 *
 * @module lark-chat-service
 */

import * as lark from '@larksuiteoapi/node-sdk';
import { config } from '@/core/config/config';

/** 标签绑定的实体类型；Feishu tag API 要求传 'chat'，与 lark 交互类型的 'chat' 含义不同 */
const TAG_ENTITY_TYPE = 'chat';

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
    const { appId, receiveId } = config.lark;

    if (!receiveId) {
      throw new Error('Missing required Lark config: AIBO_LARK_RECEIVE_ID');
    }
    if (!appId) {
      throw new Error('Missing required Lark config: AIBO_LARK_APP_ID');
    }

    // 1. 查找是否已有以 cwd 命名的标签
    const tagId = await this.findOrCreateTag(cwd);

    // 2. 通过标签绑定关系查找已有群聊
    const existingChatId = await this.findChatByTag(tagId);
    if (existingChatId) {
      console.log(`✅ 找到已有群聊: ${existingChatId}，跳过创建`);
      return existingChatId;
    }

    // 3. 创建群聊
    const chatId = await this.createChat(cwd, receiveId, appId);

    // 4. 绑定标签到群聊
    await this.bindTagToChat(tagId, chatId);

    // 5. 更新群公告
    await this.updateChatAnnouncement(chatId, cwd);

    return chatId;
  }

  /**
   * 查找名称匹配 cwd 的标签，若不存在则创建并返回其 id。
   */
  private async findOrCreateTag(cwd: string): Promise<string> {
    // 查询标签列表，按名称过滤
    const listResp = await this.client.request({
      method: 'GET',
      url: '/open-apis/tenant/v2/tags',
      params: { name: cwd, tag_type: TAG_ENTITY_TYPE },
    });

    const tags: Array<{ id: string; name: string }> = listResp?.data?.items ?? [];
    const existing = tags.find((t) => t.name === cwd);
    if (existing) {
      console.log(`🏷️  找到已有标签 id=${existing.id}`);
      return existing.id;
    }

    // 创建新标签
    const createResp = await this.client.request({
      method: 'POST',
      url: '/open-apis/tenant/v2/tags',
      data: {
        name: cwd,
        tag_type: TAG_ENTITY_TYPE,
      },
    });

    const tagId: string | undefined = createResp?.data?.tag_detail?.id;
    if (!tagId) {
      throw new Error(`创建标签失败，响应: ${JSON.stringify(createResp)}`);
    }

    console.log(`🏷️  创建标签成功 id=${tagId}`);
    return tagId;
  }

  /**
   * 通过标签 id 查询绑定的群聊，返回第一个绑定的 chat_id，或 null。
   */
  private async findChatByTag(tagId: string): Promise<string | null> {
    const resp = await this.client.request({
      method: 'GET',
      url: '/open-apis/tenant/v2/tag_relationships/search',
      params: { tag_id: tagId, entity_type: TAG_ENTITY_TYPE },
    });

    const relationships: Array<{ entity_id: string }> = resp?.data?.items ?? [];
    if (relationships.length > 0) {
      return relationships[0].entity_id;
    }
    return null;
  }

  /**
   * 创建飞书群聊，返回 chat_id。
   */
  private async createChat(name: string, receiveId: string, botId: string): Promise<string> {
    // `as any` is required because the Lark Node SDK types do not yet expose
    // all fields for the chat create request (e.g. bot_id_list, restricted_mode_setting).
    const resp = await (this.client.im.chat as any).create({
      data: {
        name,
        description: `aibo 工作目录: ${name}`,
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

  /**
   * 将标签绑定到群聊。
   */
  private async bindTagToChat(tagId: string, chatId: string): Promise<void> {
    await this.client.request({
      method: 'POST',
      url: '/open-apis/tenant/v2/tag_relationships',
      data: {
        tag_id: tagId,
        entity_id: chatId,
        entity_type: TAG_ENTITY_TYPE,
      },
    });

    console.log(`🔗 标签 ${tagId} 已绑定到群聊 ${chatId}`);
  }

  /**
   * 更新群公告内容为当前工作目录路径。
   * 首先获取当前公告 revision，再提交更新以避免版本冲突。
   */
  private async updateChatAnnouncement(chatId: string, cwd: string): Promise<void> {
    // `as any` is required because the Lark Node SDK types for chatAnnouncement
    // do not fully expose all patch request fields.

    // Fetch current revision to avoid version conflict
    let currentRevision = '0';
    try {
      const getResp = await (this.client.im.chatAnnouncement as any).get({
        path: { chat_id: chatId },
      });
      currentRevision = getResp?.data?.revision ?? '0';
    } catch {
      // If fetch fails, proceed with revision '0' (safe for freshly created chats)
    }

    await (this.client.im.chatAnnouncement as any).patch({
      path: { chat_id: chatId },
      data: {
        revision: currentRevision,
        requests: [
          JSON.stringify({
            requestType: 'InsertBlocksAtDocumentEnd',
            insertBlocksAtDocumentEndRequest: {
              payload: {
                blocks: [
                  {
                    blockType: 2,
                    text: {
                      style: {},
                      elements: [
                        {
                          textRun: {
                            content: `工作目录: ${cwd}`,
                            textElementStyle: {},
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          }),
        ],
      },
    });

    console.log(`📢 群公告已更新`);
  }
}
