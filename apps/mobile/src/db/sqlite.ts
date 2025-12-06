import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';
import {
  IDBAiMessage,
  IDBChatMessage,
  IDBChatMessageRow,
  IDBUserMessage,
} from '../types/vivaAi.types';

SQLite.DEBUG(false);
SQLite.enablePromise(true);

class ChatDatabase {
  private database: SQLiteDatabase | null = null;
  private dbName = 'chat_history.db';

  async init(): Promise<void> {
    try {
      if (this.database) {
        console.log('Database already initialized');
        return;
      }

      this.database = await SQLite.openDatabase({
        name: this.dbName,
        location: 'default',
      });

      console.log('Database opened successfully');
      await this.createTables();
    } catch (error) {
      console.error('Failed to initialize database:', error);
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
                uuid TEXT,
                text TEXT NOT NULL,
                educational_message TEXT,
                why_this_matters TEXT,
                options TEXT,
                node_type TEXT,
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
      console.log('chat_messages table created');

      await this.addColumnIfNotExists('chat_messages', 'node_type', 'TEXT');

      for (const indexQuery of createIndexQueries) {
        await this.database.executeSql(indexQuery);
      }
      console.log('Indexes created');
    } catch (error) {
      console.error('Failed to create tables:', error);
      throw error;
    }
  }

  async addColumnIfNotExists(
    tableName: string,
    columnName: string,
    columnType: string,
  ) {
    const query = `PRAGMA table_info(${tableName});`;
    const [result] = await this.database!.executeSql(query);

    let exists = false;
    for (let i = 0; i < result.rows.length; i++) {
      if (result.rows.item(i).name === columnName) {
        exists = true;
        break;
      }
    }

    if (!exists) {
      const alterQuery = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType};`;
      await this.database!.executeSql(alterQuery);
      console.log(`Added missing column '${columnName}'`);
    } else {
      console.log(`Column '${columnName}' already exists`);
    }
  }

  async saveAiMessage(
    userId: string,
    flowSlug: string,
    message: IDBAiMessage,
  ): Promise<void> {
    if (!this.database) {
      await this.init();
    }

    const query = `
      INSERT INTO chat_messages (
        user_id, flow_slug, message_type, message_id, flow_instance_id, uuid, 
        text, educational_message, why_this_matters, options, node_type, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const params = [
      userId,
      flowSlug,
      'ai',
      message.id,
      message.flowInstanceId,
      message.uuid,
      message.text,
      message.educationalMessage || null,
      message.whyThisMatters || null,
      JSON.stringify(message.options),
      message.nodeType || null,
      message.timestamp,
    ];

    try {
      await this.database!.executeSql(query, params);
      console.log(`AI message saved: ${message.id}`);
    } catch (error) {
      console.error('Failed to save AI message:', error);
      throw error;
    }
  }

  async saveUserMessage(
    userId: string,
    flowSlug: string,
    message: IDBUserMessage,
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
      console.log('User message saved');
    } catch (error) {
      console.error('Failed to save user message:', error);
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
            WHERE user_id = ? AND flow_slug = ? AND uuid = ?;
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
  ): Promise<IDBChatMessage[]> {
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
      const messages: IDBChatMessage[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        const row: IDBChatMessageRow = result.rows.item(i);

        if (row.message_type === 'ai') {
          messages.push({
            type: 'ai',
            id: row.message_id!,
            flowInstanceId: row.flow_instance_id!,
            text: row.text,
            educationalMessage: row.educational_message || undefined,
            whyThisMatters: row.why_this_matters || undefined,
            options: row.options ? JSON.parse(row.options) : [],
            nodeType: row.node_type as any,
            timestamp: row.timestamp,
            uuid: row.uuid,
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
      console.log('Chat history cleared');
    } catch (error) {
      console.error('Failed to clear chat history:', error);
      throw error;
    }
  }

  async getLastAiMessage(
    userId: string,
    flowSlug: string,
  ): Promise<IDBAiMessage | null> {
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

      const row: IDBChatMessageRow = result.rows.item(0);
      return {
        type: 'ai',
        id: row.message_id!,
        flowInstanceId: row.flow_instance_id!,
        text: row.text,
        educationalMessage: row.educational_message || undefined,
        whyThisMatters: row.why_this_matters || undefined,
        options: row.options ? JSON.parse(row.options) : [],
        nodeType: row.node_type as any,
        timestamp: row.timestamp,
        uuid: row.uuid,
      };
    } catch (error) {
      console.error('Failed to get last AI message:', error);
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.database) {
      await this.database.close();
      this.database = null;
      console.log('Database closed');
    }
  }
}

// Export singleton instance
export const chatDB = new ChatDatabase();
