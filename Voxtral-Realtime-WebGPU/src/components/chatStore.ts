export type Message = { role: "user" | "assistant"; content: string; heardContent?: string; interrupted?: boolean };
export type Chat = { id: string; title: string; model: string; messages: Message[]; updatedAt: number };
export const CHAT_KEY = "voz-local-chats-v1";
export const DEFAULT_MODEL = "phi3:latest";
export const newChat = (model = DEFAULT_MODEL): Chat => ({ model, id: crypto.randomUUID(), title: "Nueva conversación", messages: [], updatedAt: Date.now() });
export function readChats(): { chats: Chat[]; activeId: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(CHAT_KEY) || "null");
    if (Array.isArray(saved?.chats) && saved.chats.length && saved.chats.every((c: Chat) => typeof c.id === "string" && typeof c.title === "string" && Array.isArray(c.messages) && c.messages.every(m => ["user", "assistant"].includes(m.role) && typeof m.content === "string"))) {
      return { chats: saved.chats.map((chat: Chat) => ({ ...chat, model: typeof chat.model === "string" && chat.model.trim() ? chat.model : DEFAULT_MODEL })), activeId: saved.chats.some((c: Chat) => c.id === saved.activeId) ? saved.activeId : saved.chats[0].id };
    }
    const legacy = JSON.parse(localStorage.getItem("voz-local-history") || "null");
    const chat = newChat();
    if (Array.isArray(legacy) && legacy.every(m => ["user", "assistant"].includes(m.role) && typeof m.content === "string")) {
      chat.messages = legacy; chat.title = legacy.find(m => m.role === "user")?.content.slice(0, 45) || chat.title;
    }
    return { chats: [chat], activeId: chat.id };
  } catch { const chat = newChat(); return { chats: [chat], activeId: chat.id }; }
}
export function updateChat(chats: Chat[], id: string, update: Message[] | ((messages: Message[]) => Message[])): Chat[] {
  return chats.map(chat => {
    if (chat.id !== id) return chat;
    const messages = typeof update === "function" ? update(chat.messages) : update;
    return { ...chat, messages, title: chat.title.startsWith("Rama · ") ? chat.title : messages.find(m => m.role === "user")?.content.slice(0, 45) || "Nueva conversación", updatedAt: Date.now() };
  });
}
