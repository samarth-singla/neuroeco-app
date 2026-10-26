import { useEffect, useState } from 'react';

export default function App() {
  const [status, setStatus] = useState('checking…');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d: { ok: boolean }) => setStatus(d.ok ? 'API connected' : 'API error'))
      .catch(() => setStatus('API unreachable'));
  }, []);

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Research prototype</h1>
      <p className="mt-2 text-sm text-gray-400" data-testid="health">
        {status}
      </p>
    </main>
  );
}
