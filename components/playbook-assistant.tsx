"use client";

import { useEffect, useRef, useState } from "react";

import { answerPlaybookQuestion } from "@/lib/playbook-assistant";
import { PLAYBOOK_STEPS } from "@/lib/playbook";
import { type CustomerSession, roleDisplayLabel } from "@/lib/session";
import type { PlaybookStep } from "@/lib/types";

function welcomeMessage(session?: CustomerSession | null): string {
  if (session) {
    return `Hi! How can I help with ${session.customerName}'s EA? You're set up as ${roleDisplayLabel(session)}.`;
  }

  return "Hi! How can I help you with your EA?";
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  stream?: boolean;
};

const STARTER_QUESTIONS = [
  "How do I identify EA targets?",
  "How does True Forward work?",
  "What happens during onboarding?",
  "How do I prep for EA renewal?",
];

const THINKING_DELAY_MS = 450;
const STREAM_CHUNK_MS = 16;

type PlaybookAssistantProps = {
  session?: CustomerSession | null;
  completedIds: Set<string>;
  onMarkStepComplete: (step: PlaybookStep) => void;
};

export function PlaybookAssistant({
  session,
  completedIds,
  onMarkStepComplete,
}: PlaybookAssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const messageId = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastStepIdRef = useRef<string | undefined>(undefined);
  const completedIdsRef = useRef(completedIds);

  useEffect(() => {
    completedIdsRef.current = completedIds;
  }, [completedIds]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      content: welcomeMessage(session),
    },
  ]);

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: welcomeMessage(session),
      },
    ]);
    lastStepIdRef.current = undefined;
  }, [session?.customerName, session?.userRole, session?.email, session?.otherRoleLabel]);

  const hasUserMessage = messages.some((message) => message.role === "user");
  const isStreaming = messages.some((message) => message.stream);
  const showStarterQuestions =
    input.length === 0 && !hasUserMessage && !isResponding && !isStreaming;

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isResponding, isStreaming]);

  function completeStream(messageId: string) {
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId ? { ...item, stream: false } : item,
      ),
    );
  }

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isResponding || isStreaming) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${++messageId.current}`,
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsResponding(true);

    window.setTimeout(() => {
      const result = answerPlaybookQuestion(trimmed, {
        completedIds: completedIdsRef.current,
        lastStepId: lastStepIdRef.current,
        userRole: session?.userRole,
        customerName: session?.customerName,
      });

      if (result.lastStepId) {
        lastStepIdRef.current = result.lastStepId;
      }

      result.actions?.forEach((action) => {
        if (action.type === "markStepComplete") {
          const step = PLAYBOOK_STEPS.find((item) => item.id === action.stepId);
          if (step) {
            onMarkStepComplete(step);
          }
        }
      });

      const assistantMessage: ChatMessage = {
        id: `assistant-${++messageId.current}`,
        role: "assistant",
        content: result.answer,
        stream: true,
      };

      setMessages((current) => [...current, assistantMessage]);
      setIsResponding(false);
    }, THINKING_DELAY_MS);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="fixed right-5 bottom-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition hover:bg-primary/90"
      >
        <SparkleIcon className="size-4" />
        EA Assistant
      </button>

      {open ? (
        <div className="fixed right-5 bottom-20 z-40 flex h-[min(32rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-foreground">EA Assistant</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close assistant"
              >
                <CloseIcon className="size-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl px-3 py-2.5 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "ml-8 bg-primary/10 text-foreground"
                    : "mr-4 bg-muted text-foreground"
                }`}
              >
                {message.role === "assistant" && message.stream ? (
                  <StreamingText
                    text={message.content}
                    onComplete={() => completeStream(message.id)}
                  />
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            ))}

            {isResponding ? (
              <div className="mr-4 rounded-xl bg-muted px-3 py-2.5">
                <TypingIndicator />
              </div>
            ) : null}
          </div>

          <div className="border-t border-border px-4 py-3">
            {showStarterQuestions ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {STARTER_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => ask(question)}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                  >
                    {question}
                  </button>
                ))}
              </div>
            ) : null}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                ask(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask a question..."
                disabled={isResponding || isStreaming}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isResponding || isStreaming || !input.trim()}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function StreamingText({
  text,
  onComplete,
}: {
  text: string;
  onComplete: () => void;
}) {
  const [displayed, setDisplayed] = useState("");
  const [isStreaming, setIsStreaming] = useState(true);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    completedRef.current = false;
    setDisplayed("");
    setIsStreaming(true);

    const tokens = text.match(/\S+|\s+/g) ?? [];
    if (tokens.length === 0) {
      setIsStreaming(false);
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
      return;
    }

    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setDisplayed(tokens.slice(0, index).join(""));

      if (index >= tokens.length) {
        window.clearInterval(interval);
        setIsStreaming(false);
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
      }
    }, STREAM_CHUNK_MS);

    return () => window.clearInterval(interval);
  }, [text]);

  return (
    <p className="whitespace-pre-wrap">
      {displayed}
      {isStreaming ? <StreamCursor /> : null}
    </p>
  );
}

function StreamCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-px animate-pulse bg-foreground/70"
      aria-hidden="true"
    />
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-0.5" aria-label="Assistant is typing">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
    </div>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.937A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
