import { useEffect, useRef, useState } from "react";

const ChatBox = ({ messages, onSendMessage, currentUser }) => {
  const [message, setMessage] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const cleanMessage = message.trim();
    if (!cleanMessage) {
      return;
    }
    onSendMessage(cleanMessage);
    setMessage("");
  };

  return (
    <section className="flex h-full min-h-[420px] flex-col rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">Meeting Chat</h2>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-sm text-slate-500">No messages yet. Say hello to the room.</p>}
        {messages.map((item) => {
          const mine = item.userId?._id === currentUser?._id;
          return (
            <div key={item._id || `${item.timestamp}-${item.message}`} className={mine ? "text-right" : "text-left"}>
              <div
                className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  mine
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                <p className="mb-1 text-xs font-semibold opacity-80">{mine ? "You" : item.userId?.name || "Guest"}</p>
                <p>{item.message}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="field !rounded-xl !py-2"
          placeholder="Type a message..."
        />
        <button className="primary-button !rounded-xl !px-4 !py-2" type="submit">
          Send
        </button>
      </form>
    </section>
  );
};

export default ChatBox;
