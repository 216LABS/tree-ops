export const metadata = { title: 'Use your job link' };

export default function CrewNote() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-900 p-6 text-center text-white">
      <div className="max-w-sm">
        <h1 className="font-display text-3xl font-semibold">Use the link your office texts you</h1>
        <p className="mt-3 text-slate-300">Crews don’t need to sign in. Each job day comes as a link by text. Open it, and everything for the day is there, even with no signal.</p>
        <form action="/api/auth/signout" method="post" className="mt-6">
          <button className="min-h-12 rounded-control bg-slate-700 px-5 font-semibold">Sign out</button>
        </form>
      </div>
    </div>
  );
}
