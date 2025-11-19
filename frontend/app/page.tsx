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

  const [ceremonyTime, setCeremonyTime] = useState('4:30 PM');
  const [firstLook, setFirstLook] = useState(true);
  const [groupPhotoCount, setGroupPhotoCount] = useState(10);
  const [travelMinutes, setTravelMinutes] = useState(0);

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
          ceremony_time: ceremonyTime,
          first_look: firstLook,
          group_photo_count: groupPhotoCount,
          travel_minutes_between_locations: travelMinutes,
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
        
        <section className="border rounded-lg p-4 space-y-3 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-800">
            Timeline settings
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-slate-600">Ceremony time</span>
              <input
                className="border rounded-md px-2 py-1 text-sm"
                value={ceremonyTime}
                onChange={(e) => setCeremonyTime(e.target.value)}
                placeholder="4:30 PM"
              />
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={firstLook}
                onChange={(e) => setFirstLook(e.target.checked)}
              />
              <span className="text-slate-600">Include first look</span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-slate-600">Group photo count</span>
              <input
                type="number"
                className="border rounded-md px-2 py-1 text-sm"
                value={groupPhotoCount}
                onChange={(e) => setGroupPhotoCount(Number(e.target.value) || 0)}
                min={0}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-slate-600">Travel minutes between locations</span>
              <input
                type="number"
                className="border rounded-md px-2 py-1 text-sm"
                value={travelMinutes}
                onChange={(e) => setTravelMinutes(Number(e.target.value) || 0)}
                min={0}
              />
            </label>
          </div>
          <p className="text-xs text-slate-500">
            These settings will be used the next time you click &quot;Generate timeline&quot; for any project.
          </p>
        </section>

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