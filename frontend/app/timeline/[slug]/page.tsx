import TimelineClient from './TimelineClient';

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // In Next 16, params can be a Promise → unwrap it:
  const { slug } = await params;

  return <TimelineClient slug={slug} />;
}