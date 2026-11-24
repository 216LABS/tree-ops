import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6 text-center">
      <div>
        <h1 className="font-display text-3xl font-semibold">Not found</h1>
        <p className="mt-2 text-muted">That page or link doesn’t exist, or it has ended.</p>
        <Link href="/" className="mt-4 inline-block text-link underline">Go home</Link>
      </div>
    </main>
  );
}
