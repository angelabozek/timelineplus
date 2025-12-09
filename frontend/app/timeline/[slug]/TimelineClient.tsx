'use client';

import React, { useEffect, useState } from 'react';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { SortableItem } from "./SortableItem"; 

function formatISODate(iso: string | null): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const API_URL = 'http://localhost:8000';

type TimelineItem = {
  id: string;
  time: string;
  label: string;
};

type TimelineResponse = {
  title: string | null;
  event_date: string | null;
  items: TimelineItem[];
};

export default function TimelineClient({ slug }: { slug: string }) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [editableTitle, setEditableTitle] = useState<string>('');
  const [editableDate, setEditableDate] = useState<string>(''); 

  // -----------------------------
  // DND-KIT SENSORS
  // -----------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  // -----------------------------
  // LOAD TIMELINE
  // -----------------------------
  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const res = await fetch(`${API_URL}/t/${slug}`, { cache: 'no-store' });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'Timeline not found');
        }

        const json: TimelineResponse = await res.json();

        const enrichedItems = (json.items || []).map((item) => ({
          ...item,
          id: item.id || crypto.randomUUID(),
        }));

        setData(json);
        setItems(enrichedItems);

        setEditableTitle(json.title ?? '');
        setEditableDate(json.event_date ?? '');
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error loading timeline');
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [slug]);

  // -----------------------------
  // ITEM CHANGE HANDLERS
  // -----------------------------
  const handleItemChange = (
    index: number,
    field: keyof TimelineItem,
    value: string
  ) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        time: '',
        label: 'New item',
      },
    ]);
  };

  // -----------------------------
  // COPY TEXT
  // -----------------------------
  const handleCopy = async () => {
    if (!data) return;

    const headerTitle = editableTitle || data.title || 'Wedding Timeline';

    let headerDate = '';
    if (editableDate) {
      headerDate = formatISODate(editableDate);
    } else if (data.event_date) {
      headerDate = formatISODate(data.event_date);
    }

    const lines = [
      headerTitle,
      headerDate,
      '',
      ...items.map((it) => `${it.time} – ${it.label}`),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopyMessage('Copied!');
      setTimeout(() => setCopyMessage(null), 1500);
    } catch (e) {
      console.error(e);
      setCopyMessage('Could not copy');
      setTimeout(() => setCopyMessage(null), 1500);
    }
  };

  // -----------------------------
  // SAVE CHANGES
  // -----------------------------
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    const sortedItems = [...items].sort((a, b) =>
      (a.time || '').localeCompare(b.time || '')
    );
    setItems(sortedItems);

    const payload = {
      title: editableTitle || null,
      event_date: editableDate || null,
      items: items.map((it) => ({
        id: it.id,
        time: it.time,
        label: it.label,
      })),
    };

    try {
      const res = await fetch(`${API_URL}/timeline/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to save timeline');
      }

      const json = await res.json();

      const enrichedItems = (json.items || []).map((item: TimelineItem) => ({
        ...item,
        id: item.id || crypto.randomUUID(),
      }));

      setItems(enrichedItems);

      setData((prev) =>
        prev
          ? {
              ...prev,
              title: json.title ?? prev.title,
              event_date: json.event_date ?? prev.event_date,
            }
          : prev
      );

      setSaveMessage('Saved');
    } catch (e: any) {
      console.error(e);
      setSaveMessage('Save failed');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 2000);
    }
  };

  // -----------------------------
  // RENDER UI
  // -----------------------------
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex justify-center items-center">
        <div className="text-sm text-slate-500">Loading timeline…</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-50 flex justify-center items-center">
        <div className="bg-white border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm shadow">
          {error || 'Timeline not found'}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex justify-center p-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-md p-6 space-y-6">

        {/* HEADER */}
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Wedding Day Timeline
            </p>

            {editMode ? (
              <div className="space-y-2">
                <input
                  className="border rounded-md px-2 py-1 text-sm w-full"
                  placeholder="Wedding title"
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                />
                <input
                  type="date"
                  className="border rounded-md px-2 py-1 text-sm"
                  value={editableDate}
                  onChange={(e) => setEditableDate(e.target.value)}
                />
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-semibold">
                  {data.title || 'Wedding Timeline'}
                </h1>
                {data.event_date && (
                  <p className="text-sm text-slate-500">
                    {formatISODate(data.event_date)}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className="px-3 py-1.5 rounded-md border border-slate-300 text-xs hover:bg-slate-50"
            >
              {editMode ? 'Done editing' : 'Edit timeline'}
            </button>

            {editMode && (
              <button
                type="button"
                onClick={handleSave}
                className="px-3 py-1.5 rounded-md border border-emerald-400 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs hover:bg-slate-800"
            >
              Copy to clipboard
            </button>

            {copyMessage && (
              <span className="text-[10px] text-slate-500">{copyMessage}</span>
            )}
            {saveMessage && (
              <span className="text-[10px] text-slate-500">{saveMessage}</span>
            )}
          </div>
        </header>

        {/* TIMELINE LIST WITH DRAG & DROP */}
        {items.length === 0 ? (
          <p className="text-sm text-slate-600">
            No timeline items yet. Please ask your photographer or planner to
            regenerate the schedule.
          </p>
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <ol className="space-y-3">
                  {items.map((item, idx) => (
                    <SortableItem
                      key={item.id}
                      id={item.id}
                      idx={idx}
                      item={item}
                      editMode={editMode}
                      handleItemChange={handleItemChange}
                      setItems={setItems}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>

            {editMode && (
              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1.5 rounded-md border border-dashed border-slate-300 text-xs text-slate-600 hover:bg-slate-50"
                >
                  + Add item
                </button>
              </div>
            )}
          </>
        )}

        {/* FOOTER */}
        <footer className="pt-4 border-t border-slate-100 text-xs text-slate-400 flex justify-between">
          <span>Generated by Timeline+</span>
          <span>Adjust as needed, then copy &amp; share</span>
        </footer>
      </div>
    </main>
  );
}
