import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';

SQLite.DEBUG(false);
SQLite.enablePromise(true);

interface ChatMessageRow {
  id: number;
  user_id: string;
  flow_slug: string;
  message_type: 'ai' | 'user';
  message_id: string | null;
  flow_instance_id: string | null;
  text: string;
  educational_message: string | null;
  why_this_matters: string | null;
  options: string | null;
  timestamp: number;
  created_at: string;
}

export interface AiMessage {
  type: 'ai';
  id: string;
  flowInstanceId: string;
  text: string;
  educationalMessage?: string;
  whyThisMatters?: string;
  options: Array<{ id: string; label: string; value: any }>;
  timestamp: number;
}

export interface UserMessage {
  type: 'user';
  text: string;
  timestamp: number;
}

export type ChatMessage = AiMessage | UserMessage;

class ChatDatabase {
  private database: SQLiteDatabase | null = null;
  private dbName = 'chat_history.db';

  async init(): Promise<void> {
    try {
      if (this.database) {
        console.log('📦 Database already initialized');
        return;
      }

      this.database = await SQLite.openDatabase({
        name: this.dbName,
        location: 'default',
      });

      console.log('✅ Database opened successfully');
      await this.createTables();
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const createTableQuery = `
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                flow_slug TEXT NOT NULL,
                message_type TEXT NOT NULL,
                message_id TEXT,
                flow_instance_id TEXT,
                text TEXT NOT NULL,
                educational_message TEXT,
                why_this_matters TEXT,
                options TEXT,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `;

    const createIndexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_user_flow ON chat_messages(user_id, flow_slug);',
      'CREATE INDEX IF NOT EXISTS idx_message_id ON chat_messages(message_id);',
      'CREATE INDEX IF NOT EXISTS idx_timestamp ON chat_messages(timestamp);',
    ];

    try {
      await this.database.executeSql(createTableQuery);
      console.log('✅ chat_messages table created');

      for (const indexQuery of createIndexQueries) {
        await this.database.executeSql(indexQuery);
      }
      console.log('✅ Indexes created');
    } catch (error) {
      console.error('❌ Failed to create tables:', error);
      throw error;
    }
  }

  async saveAiMessage(
    userId: string,
    flowSlug: string,
    message: AiMessage,
  ): Promise<void> {
    if (!this.database) {
      await this.init();
    }

    const query = `
            INSERT INTO chat_messages (
                user_id, flow_slug, message_type, message_id, flow_instance_id,
                text, educational_message, why_this_matters, options, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;

    const params = [
      userId,
      flowSlug,
      'ai',
      message.id,
      message.flowInstanceId,
      message.text,
      message.educationalMessage || null,
      message.whyThisMatters || null,
      JSON.stringify(message.options),
      message.timestamp,
    ];

    try {
      await this.database!.executeSql(query, params);
      console.log(`✅ AI message saved: ${message.id}`);
    } catch (error) {
      console.error('❌ Failed to save AI message:', error);
      throw error;
    }
  }

  async saveUserMessage(
    userId: string,
    flowSlug: string,
    message: UserMessage,
  ): Promise<void> {
    if (!this.database) {
      await this.init();
    }

    const query = `
            INSERT INTO chat_messages (
                user_id, flow_slug, message_type, text, timestamp
            ) VALUES (?, ?, ?, ?, ?);
        `;

    const params = [userId, flowSlug, 'user', message.text, message.timestamp];

    try {
      await this.database!.executeSql(query, params);
      console.log('✅ User message saved');
    } catch (error) {
      console.error('❌ Failed to save user message:', error);
      throw error;
    }
  }

  async messageExists(
    userId: string,
    flowSlug: string,
    messageId: string,
  ): Promise<boolean> {
    if (!this.database) {
      await this.init();
    }

    const query = `
            SELECT COUNT(*) as count FROM chat_messages 
            WHERE user_id = ? AND flow_slug = ? AND message_id = ?;
        `;

    try {
      const [result] = await this.database!.executeSql(query, [
        userId,
        flowSlug,
        messageId,
      ]);
      const count = result.rows.item(0).count;
      return count > 0;
    } catch (error) {
      console.error('❌ Failed to check message existence:', error);
      return false;
    }
  }

  async getChatHistory(
    userId: string,
    flowSlug: string,
  ): Promise<ChatMessage[]> {
    if (!this.database) {
      await this.init();
    }

    const query = `
            SELECT * FROM chat_messages 
            WHERE user_id = ? AND flow_slug = ? 
            ORDER BY timestamp ASC;
        `;

    try {
      const [result] = await this.database!.executeSql(query, [
        userId,
        flowSlug,
      ]);
      const messages: ChatMessage[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        const row: ChatMessageRow = result.rows.item(i);

        if (row.message_type === 'ai') {
          messages.push({
            type: 'ai',
            id: row.message_id!,
            flowInstanceId: row.flow_instance_id!,
            text: row.text,
            educationalMessage: row.educational_message || undefined,
            whyThisMatters: row.why_this_matters || undefined,
            options: row.options ? JSON.parse(row.options) : [],
            timestamp: row.timestamp,
          });
        } else {
          messages.push({
            type: 'user',
            text: row.text,
            timestamp: row.timestamp,
          });
        }
      }

      console.log(`📚 Loaded ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('❌ Failed to get chat history:', error);
      return [];
    }
  }

  async clearChatHistory(userId: string, flowSlug: string): Promise<void> {
    if (!this.database) {
      await this.init();
    }

    const query =
      'DELETE FROM chat_messages WHERE user_id = ? AND flow_slug = ?;';

    try {
      await this.database!.executeSql(query, [userId, flowSlug]);
      console.log('✅ Chat history cleared');
    } catch (error) {
      console.error('❌ Failed to clear chat history:', error);
      throw error;
    }
  }

  async getLastAiMessage(
    userId: string,
    flowSlug: string,
  ): Promise<AiMessage | null> {
    if (!this.database) {
      await this.init();
    }

    const query = `
            SELECT * FROM chat_messages 
            WHERE user_id = ? AND flow_slug = ? AND message_type = 'ai' 
            ORDER BY timestamp DESC LIMIT 1;
        `;

    try {
      const [result] = await this.database!.executeSql(query, [
        userId,
        flowSlug,
      ]);

      if (result.rows.length === 0) {
        return null;
      }

      const row: ChatMessageRow = result.rows.item(0);
      return {
        type: 'ai',
        id: row.message_id!,
        flowInstanceId: row.flow_instance_id!,
        text: row.text,
        educationalMessage: row.educational_message || undefined,
        whyThisMatters: row.why_this_matters || undefined,
        options: row.options ? JSON.parse(row.options) : [],
        timestamp: row.timestamp,
      };
    } catch (error) {
      console.error('❌ Failed to get last AI message:', error);
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.database) {
      await this.database.close();
      this.database = null;
      console.log('✅ Database closed');
    }
  }
}

// Export singleton instance
export const chatDB = new ChatDatabase();
