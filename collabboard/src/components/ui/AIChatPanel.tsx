"use client";

import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

interface AIChatPanelProps {
  boardId: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

interface ChatMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function AIChatPanel({
  boardId,
  userId,
  isOpen,
  onClose,
  isDarkMode,
}: AIChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const idTokenRef = useRef("");
  const activeChatIdRef = useRef<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatList, setChatList] = useState<ChatMeta[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const prevStatusRef = useRef<string>("");

  // Suppress isDarkMode unused warning — kept for API compatibility; theme is now CSS-driven
  void isDarkMode;

  // Get Firebase ID token for server-side Firestore access
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          if (token) idTokenRef.current = token;
        } catch { /* auth not ready */ }
      }
    });
    const interval = setInterval(async () => {
      try {
        const token = await auth?.currentUser?.getIdToken();
        if (token) idTokenRef.current = token;
      } catch { /* ignore */ }
    }, 50 * 60 * 1000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const customFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        const freshToken = await auth?.currentUser?.getIdToken();
        if (freshToken) idTokenRef.current = freshToken;
      } catch { /* use cached token */ }

      const headers = new Headers(init?.headers);
      headers.set("x-firebase-token", idTokenRef.current);
      return globalThis.fetch(input, { ...init, headers });
    },
    []
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { boardId, userId },
        fetch: customFetch,
      }),
    [boardId, userId, customFetch]
  );

  const { messages, sendMessage, setMessages, status, error, clearError, stop } =
    useChat({ transport });

  // --- Firestore chat persistence ---

  const chatsCollection = useMemo(
    () => collection(db, "boards", boardId, "aiChats"),
    [boardId]
  );

  const loadChatList = useCallback(async () => {
    try {
      const q = query(chatsCollection, orderBy("updatedAt", "desc"), limit(30));
      const snapshot = await getDocs(q);
      setChatList(
        snapshot.docs.map((d) => ({
          id: d.id,
          title: (d.data().title as string) || "Chat",
          createdAt: (d.data().createdAt as number) || 0,
          updatedAt: (d.data().updatedAt as number) || 0,
        }))
      );
    } catch { /* ignore if collection doesn't exist yet */ }
  }, [chatsCollection]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveChat = useCallback(
    async (chatId: string, msgs: any[]) => {
      if (msgs.length === 0) return;
      const firstUserMsg = msgs.find(
        (m: { role: string }) => m.role === "user"
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const titlePart = firstUserMsg?.parts?.find(
        (p: any) => p.type === "text"
      );
      const title = titlePart?.text?.slice(0, 60) || "Chat";

      const docRef = doc(chatsCollection, chatId);
      const existing = await getDoc(docRef).catch(() => null);
      const createdAt = existing?.exists()
        ? existing.data().createdAt
        : Date.now();

      await setDoc(docRef, {
        title,
        createdAt,
        updatedAt: Date.now(),
        userId,
        messagesJson: JSON.stringify(msgs),
      });
    },
    [chatsCollection, userId]
  );

  const loadChat = useCallback(
    async (chatId: string) => {
      if (
        activeChatIdRef.current &&
        activeChatIdRef.current !== chatId &&
        messages.length > 0
      ) {
        await saveChat(activeChatIdRef.current, messages);
      }
      try {
        const snap = await getDoc(doc(chatsCollection, chatId));
        if (snap.exists()) {
          const data = snap.data();
          const loaded = JSON.parse(data.messagesJson || "[]");
          setMessages(loaded);
          activeChatIdRef.current = chatId;
          setActiveChatId(chatId);
        }
      } catch { /* ignore */ }
      setShowHistory(false);
    },
    [chatsCollection, messages, saveChat, setMessages]
  );

  const startNewChat = useCallback(async () => {
    if (activeChatIdRef.current && messages.length > 0) {
      await saveChat(activeChatIdRef.current, messages);
    }
    setMessages([]);
    activeChatIdRef.current = null;
    setActiveChatId(null);
    setShowHistory(false);
    await loadChatList();
  }, [messages, saveChat, setMessages, loadChatList]);

  const deleteChatEntry = useCallback(
    async (chatId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await deleteDoc(doc(chatsCollection, chatId));
        setChatList((prev) => prev.filter((c) => c.id !== chatId));
        if (activeChatIdRef.current === chatId) {
          setMessages([]);
          activeChatIdRef.current = null;
          setActiveChatId(null);
        }
      } catch { /* ignore */ }
    },
    [chatsCollection, setMessages]
  );

  useEffect(() => {
    loadChatList();
  }, [loadChatList]);

  useEffect(() => {
    const wasActive =
      prevStatusRef.current === "streaming" ||
      prevStatusRef.current === "submitted";
    prevStatusRef.current = status;

    if (wasActive && status === "ready" && messages.length > 0) {
      if (!activeChatIdRef.current) {
        const newId = doc(chatsCollection).id;
        activeChatIdRef.current = newId;
        setActiveChatId(newId);
      }
      saveChat(activeChatIdRef.current, messages).then(() => loadChatList());
    }
  }, [status, messages, saveChat, loadChatList, chatsCollection]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div
      className="fixed top-12 right-0 bottom-0 z-40 flex flex-col"
      style={{
        width: 380,
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-subtle)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4"
        style={{
          height: 48,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            AI Assistant
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {/* New chat button */}
          <button
            onClick={startNewChat}
            className="w-7 h-7 flex items-center justify-center cursor-pointer"
            style={{
              color: "var(--text-tertiary)",
              background: "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              transition: "all var(--duration-fast) var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--accent)";
              e.currentTarget.style.background = "var(--bg-surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-tertiary)";
              e.currentTarget.style.background = "transparent";
            }}
            title="New chat"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          {/* History toggle */}
          <button
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) loadChatList();
            }}
            className="w-7 h-7 flex items-center justify-center cursor-pointer"
            style={{
              color: showHistory ? "var(--accent)" : "var(--text-tertiary)",
              background: showHistory ? "var(--bg-surface-hover)" : "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              transition: "all var(--duration-fast) var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--accent)";
              e.currentTarget.style.background = "var(--bg-surface-hover)";
            }}
            onMouseLeave={(e) => {
              if (!showHistory) {
                e.currentTarget.style.color = "var(--text-tertiary)";
                e.currentTarget.style.background = "transparent";
              }
            }}
            title="Chat history"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center cursor-pointer"
            style={{
              color: "var(--text-tertiary)",
              background: "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              transition: "all var(--duration-fast) var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-tertiary)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div
          className="overflow-y-auto"
          style={{
            maxHeight: 260,
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
          }}
        >
          {chatList.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
              No chat history yet
            </div>
          ) : (
            chatList.map((chat) => (
              <button
                key={chat.id}
                onClick={() => loadChat(chat.id)}
                className="w-full text-left px-4 py-2.5 flex items-center justify-between group cursor-pointer"
                style={{
                  background: activeChatId === chat.id ? "var(--accent-muted)" : "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--border-subtle)",
                  transition: "background var(--duration-fast) var(--ease-out)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-surface-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    activeChatId === chat.id ? "var(--accent-muted)" : "transparent";
                }}
              >
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                    {chat.title}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    {timeAgo(chat.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteChatEntry(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center flex-shrink-0 cursor-pointer"
                  style={{
                    color: "var(--text-tertiary)",
                    background: "none",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    transition: "all var(--duration-fast) var(--ease-out)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--error)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
                  title="Delete chat"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </button>
            ))
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !showHistory && (
          <div className="text-center py-8 space-y-4">
            <div
              className="w-12 h-12 flex items-center justify-center mx-auto"
              style={{ background: "var(--accent-muted)", borderRadius: "var(--radius-lg)" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                AI Board Assistant
              </p>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                I can create, move, and arrange objects on your board.
              </p>
            </div>
            <div className="space-y-2">
              {[
                "Create a SWOT analysis template",
                "Add a yellow sticky note that says 'Idea'",
                "Arrange all sticky notes in a grid",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => sendMessage({ text: example })}
                  className="block w-full text-left text-xs px-3 py-2 cursor-pointer"
                  style={{
                    background: "var(--bg-surface-hover)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    transition: "border-color var(--duration-fast) var(--ease-out)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
                >
                  &quot;{example}&quot;
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap"
              style={{
                background: msg.role === "user" ? "var(--accent)" : "var(--bg-surface-hover)",
                color: msg.role === "user" ? "#ffffff" : "var(--text-primary)",
                borderRadius:
                  msg.role === "user"
                    ? "var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)"
                    : "var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)",
              }}
            >
              {msg.parts.map((part, i) => {
                if (part.type === "text") {
                  return <span key={i}>{part.text}</span>;
                }
                if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                  const rawName = part.type === "dynamic-tool"
                    ? (part as { toolName?: string }).toolName || "tool"
                    : part.type.replace("tool-", "");
                  const toolName = rawName
                    .replace(/([A-Z])/g, " $1")
                    .trim();
                  const state = (part as { state?: string }).state;
                  const isRunning = state === "input-streaming" || state === "input-available";
                  const isDone = state === "output-available";
                  return (
                    <div
                      key={i}
                      className="text-xs py-1 flex items-center gap-1.5"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isRunning && (
                        <>
                          <span
                            className="inline-block w-3 h-3 rounded-full border border-current border-t-transparent"
                            style={{ animation: "spin 1s linear infinite" }}
                          />
                          {toolName}...
                        </>
                      )}
                      {isDone && (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {toolName}
                        </>
                      )}
                      {!isRunning && !isDone && (
                        <>
                          <span
                            className="inline-block w-3 h-3 rounded-full border border-current border-t-transparent"
                            style={{ animation: "spin 1s linear infinite" }}
                          />
                          {toolName}...
                        </>
                      )}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div
              className="px-3 py-2 text-sm"
              style={{
                background: "var(--bg-surface-hover)",
                color: "var(--text-tertiary)",
                borderRadius: "var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)",
              }}
            >
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div
          className="px-4 py-2 text-xs flex items-center justify-between"
          style={{ color: "var(--error)", background: "var(--error-muted)" }}
        >
          <span>Error: {error.message}</span>
          <button onClick={clearError} className="underline cursor-pointer" style={{ background: "none", border: "none", color: "inherit" }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.target as HTMLFormElement;
          const input = form.elements.namedItem("message") as HTMLInputElement;
          const value = input.value.trim();
          if (isLoading) {
            stop();
            return;
          }
          if (value) {
            sendMessage({ text: value });
            input.value = "";
          }
        }}
        className="px-4 py-3"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <div className="flex gap-2">
          <input
            name="message"
            placeholder="Ask the AI agent..."
            disabled={isLoading}
            autoComplete="off"
            className="flex-1 px-3 text-sm outline-none"
            style={{
              height: 40,
              background: "var(--bg-surface-hover)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-primary)",
              transition: "all var(--duration-fast) var(--ease-out)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--border-active)";
              e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-glow)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border-default)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="flex items-center justify-center text-white cursor-pointer"
              style={{
                width: 40,
                height: 40,
                background: "var(--error)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                transition: "all var(--duration-fast) var(--ease-out)",
              }}
              title="Stop generating"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              className="flex items-center justify-center text-white cursor-pointer"
              style={{
                width: 40,
                height: 40,
                background: "var(--accent)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                transition: "all var(--duration-fast) var(--ease-out)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
