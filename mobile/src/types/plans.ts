export type MessageType = "user" | "ai" | "tool_widget" | "system_info";

export interface ChatMessage {
  id: string;
  text?: string; // Normal mesajlar için
  sender: MessageType;
  timestamp: Date;
  isStreaming?: boolean;
  // Tool Widget için özel alanlar:
  toolData?: {
    id: string; // tool_call_id
    name: string; // request_runner_profile vb.
    submitted?: boolean; // Kullanıcı butona bastı mı?
    input?: Record<string, any>; // Tool'a gelen parametreler
  };
}

export interface PendingTool {
  id: string;
  name: string;
}
