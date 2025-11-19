'use client';

import React, { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Project = {
  id: string;
  title: string;
  event_date: string | null;
  status: string;
};

type GenerateResponse = {
  project_id: string;
  slug: string;
  items: { time: string; label: string }[];
};

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [latestSlug, setLatestSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch(`${API_URL}/projects`);
          const data = await res.json();
          setProjects(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load projects');
      }
    };
    fetchProjects();
  }, []);

  const handleGenerate = async (projectId: string) => {
    setLoading(true);
    setError(null);
    setSelectedProjectId(projectId);
    setLatestSlug(null);

    try {
      const res = await fetch(`${API_URL}/timeline/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          ceremony_time: '4:30 PM',
          first_look: true,
          group_photo_count: 10,
          travel_minutes_between_locations: 0,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to generate timeline');
      }

      const data: GenerateResponse = await res.json();
      setLatestSlug(data.slug);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error generating timeline');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8 flex justify-center">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow p-8 space-y-6">
        <h1 className="text-2xl font-bold">Timeline+ Projects</h1>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 rounded-md p-3">
            {error}
          </div>
        )}

        <div className="border rounded-lg divide-y">
          {projects.length === 0 ? (
            <div className="p-4 text-gray-600 text-sm">
              No projects yet — create one in <code>/docs</code>.
            </div>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-gray-500 text-xs">
                    {p.event_date ? `Event date: ${p.event_date}` : 'No event date'}
                    &nbsp;·&nbsp; Status: {p.status}
                  </div>
                </div>

                <button
                  onClick={() => handleGenerate(p.id)}
                  className="px-3 py-1.5 rounded-md border border-gray-300 text-sm hover:bg-gray-100 disabled:opacity-50"
                  disabled={loading && selectedProjectId === p.id}
                >
                  {loading && selectedProjectId === p.id
                    ? 'Generating...'
                    : 'Generate timeline'}
                </button>
              </div>
            ))
          )}
        </div>

        {latestSlug && (
          <div className="mt-4 space-y-1 text-sm">
            <div className="font-semibold">Generated timeline links:</div>

            <div>
              <span className="text-slate-500 mr-1">Pretty view:</span>
              <a
                href={`/timeline/${latestSlug}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline break-all"
              >
                {`http://localhost:3000/timeline/${latestSlug}`}
              </a>
            </div>

            <div>
              <span className="text-slate-500 mr-1">Raw JSON (dev):</span>
              <a
                href={`${API_URL}/t/${latestSlug}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline break-all"
              >
                {`${API_URL}/t/${latestSlug}`}
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}