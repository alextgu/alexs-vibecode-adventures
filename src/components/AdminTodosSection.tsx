"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAdminTodo,
  updateAdminTodo,
  deleteAdminTodo,
  toggleAdminTodo,
  type AdminTodo,
} from "@/lib/admin-todos";

const COMPLETED_WARN_THRESHOLD = 100;

export function AdminTodosSection({ todos }: { todos: AdminTodo[] }) {
  const [showCompleted, setShowCompleted] = useState(false);

  const open = todos
    .filter((t) => !t.completed_on)
    .sort((a, b) => {
      const ad = a.target_date ?? "￿";
      const bd = b.target_date ?? "￿";
      if (ad !== bd) return ad.localeCompare(bd);
      return a.title.localeCompare(b.title);
    });

  const done = todos
    .filter((t) => t.completed_on)
    .sort((a, b) =>
      (b.completed_on ?? "").localeCompare(a.completed_on ?? ""),
    );

  return (
    <section
      style={{
        border: "1px solid #000",
        marginTop: 16,
        height: 600,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #000",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
            gap: 8,
          }}
        >
          <h2 style={{ fontSize: 14, margin: 0 }}>To-do</h2>
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            style={{ fontSize: 12, padding: "2px 6px" }}
          >
            {showCompleted ? "Hide" : "Show"} completed ({done.length})
          </button>
        </div>
        <AddTodoForm />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 24px" }}>
        {open.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.7, padding: "6px 0" }}>
            Nothing to do.
          </div>
        ) : (
          <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
            {open.map((t) => (
              <TodoRow key={t.id} todo={t} />
            ))}
          </ul>
        )}

        {showCompleted && (
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                opacity: 0.7,
                padding: "6px 0 4px",
                borderBottom: "1px solid #000",
              }}
            >
              Completed · {done.length}
            </div>
            {done.length > COMPLETED_WARN_THRESHOLD && (
              <div
                style={{
                  fontSize: 12,
                  padding: "6px 8px",
                  margin: "6px 0",
                  border: "1px solid #000",
                  background: "#fff5b8",
                }}
              >
                Warning: {done.length} completed items — this list may be slow
                to scroll.
              </div>
            )}
            {done.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.7, padding: "6px 0" }}>
                None yet.
              </div>
            ) : (
              <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
                {done.map((t) => (
                  <TodoRow key={t.id} todo={t} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function TodoRow({ todo }: { todo: AdminTodo }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [note, setNote] = useState(todo.note ?? "");
  const [date, setDate] = useState(todo.target_date ?? "");

  const done = !!todo.completed_on;

  function onToggle() {
    startTransition(async () => {
      const res = await toggleAdminTodo(todo.id);
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  }

  function onDelete() {
    if (!window.confirm(`Delete "${todo.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteAdminTodo(todo.id);
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  }

  function onSave() {
    startTransition(async () => {
      const res = await updateAdminTodo(todo.id, {
        title,
        note: note || null,
        target_date: date || null,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <li style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%", marginBottom: 6 }}
          maxLength={80}
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (private)"
          style={{ width: "100%", marginBottom: 6 }}
          maxLength={500}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ marginBottom: 6, marginRight: 6 }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={onSave} disabled={pending}>
            {pending ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTitle(todo.title);
              setNote(todo.note ?? "");
              setDate(todo.target_date ?? "");
              setEditing(false);
            }}
            disabled={pending}
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 0",
        borderBottom: "1px solid #eee",
      }}
    >
      <input
        type="checkbox"
        checked={done}
        onChange={onToggle}
        disabled={pending}
      />
      <div
        style={{
          flex: 1,
          fontSize: 14,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ textDecoration: done ? "line-through" : "none" }}>
          {todo.title}
        </span>
        {todo.note && (
          <span style={{ opacity: 0.7 }}> — {todo.note}</span>
        )}
      </div>
      {todo.target_date && (
        <span
          style={{
            fontSize: 12,
            opacity: 0.7,
            whiteSpace: "nowrap",
          }}
        >
          {todo.target_date}
        </span>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{ fontSize: 12, padding: "2px 6px" }}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        style={{ fontSize: 12, padding: "2px 6px" }}
      >
        ×
      </button>
    </li>
  );
}

function AddTodoForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length === 0) return;
    startTransition(async () => {
      const res = await createAdminTodo({
        title,
        note: note.trim().length > 0 ? note : undefined,
        target_date: date || null,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setTitle("");
      setNote("");
      setDate("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
      }}
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New to-do"
        maxLength={80}
        style={{ flex: "2 1 160px", minWidth: 120 }}
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (private)"
        maxLength={500}
        style={{ flex: "3 1 200px", minWidth: 140 }}
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <button type="submit" disabled={pending || title.trim().length === 0}>
        {pending ? "…" : "Add"}
      </button>
    </form>
  );
}
