'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type TimelineItem = {
  time: string;
  label: string;
};

type TimelineResponse = {
  title: string | null;
  event_date: string | null;
  items: TimelineItem[];
};

export default function TimelinePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [data, setData] = useState<TimelineResponse | null>(null);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    const fetchTimeline = async () => {
      try {
        const res = await fetch(`${API_URL}/t/${slug}`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Timeline not found');
        }
        const json: TimelineResponse = await res.json();
        setData(json);
        setItems(json.items || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error loading timeline');
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [slug]);

  const handleItemChange = (index: number, field: keyof TimelineItem, value: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  };

  const handleCopy = async () => {
    if (!data) return;

    const headerTitle = data.title || 'Wedding Timeline';
    const headerDate = data.event_date
      ? new Date(data.event_date).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';

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

  const { title, event_date } = data;

  return (
    <main className="min-h-screen bg-slate-50 flex justify-center p-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-md p-6 space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Wedding Day Timeline
            </p>
            <h1 className="text-2xl font-semibold">
              {title || 'Wedding Timeline'}
            </h1>
            {event_date && (
              <p className="text-sm text-slate-500">
                {new Date(event_date).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => setEditMode((v) => !v)}
              className="px-3 py-1.5 rounded-md border border-slate-300 text-xs hover:bg-slate-50"
            >
              {editMode ? 'Done editing' : 'Edit timeline'}
            </button>

            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs hover:bg-slate-800"
            >
              Copy to clipboard
            </button>
            {copyMessage && (
              <span className="text-[10px] text-slate-500">{copyMessage}</span>
            )}
          </div>
        </header>

        {items.length === 0 ? (
          <p className="text-sm text-slate-600">
            No timeline items yet. Please ask your photographer or planner to
            regenerate the schedule.
          </p>
        ) : (
          <ol className="space-y-3">
            {items.map((item, idx) => (
              <li key={idx} className="flex gap-4 items-start">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-slate-600 mt-2" />
                  {idx !== items.length - 1 && (
                    <div className="w-px flex-1 bg-slate-200 mt-1" />
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  {editMode ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        className="border rounded-md px-2 py-1 text-xs w-24"
                        value={item.time}
                        onChange={(e) =>
                          handleItemChange(idx, 'time', e.target.value)
                        }
                      />
                      <input
                        className="border rounded-md px-2 py-1 text-xs flex-1"
                        value={item.label}
                        onChange={(e) =>
                          handleItemChange(idx, 'label', e.target.value)
                        }
                      />
                    </div>
                  ) : (
                    <>
                      <div className="text-xs font-mono text-slate-500">
                        {item.time}
                      </div>
                      <div className="text-sm font-medium text-slate-900">
                        {item.label}
                      </div>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        <footer className="pt-4 border-t border-slate-100 text-xs text-slate-400 flex justify-between">
          <span>Generated by Timeline+</span>
          <span>Adjust as needed, then copy & share</span>
        </footer>
      </div>
    </main>
  );
}