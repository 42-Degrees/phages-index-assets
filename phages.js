/* phages.js — bridge between Storyline and your backend */
(function () {
  const BACKEND = 'https://phages-backend.onrender.com';
  const DEFAULT_MANIFEST =
    'https://raw.githubusercontent.com/42-Degrees/phages-index-assets/main/manifest-mini-v1.json';

  function player() {
    try { return window.GetPlayer ? GetPlayer() : null; } catch { return null; }
  }
  function read(name, fallback = '') {
    const p = player(); if (!p) return fallback;
    try { const v = p.GetVar(name); return (v == null || v === '') ? fallback : v; } catch { return fallback; }
  }
  function write(name, value) {
    const p = player(); if (!p) return;
    try { p.SetVar(name, value); } catch {}
  }
  function setLoading(on) { write('Loading', !!on); }
  function setError(msg)   { write('ErrorText', String(msg || '')); }

  async function analyze(opts) {
    setError(''); setLoading(true);

    const prompt   = opts?.prompt   ?? read('Prompt', '');
    const manifest = opts?.manifest ?? read('ManifestUrl', DEFAULT_MANIFEST);

    const body = new URLSearchParams({ user_prompt: prompt, faiss_path: manifest });

    try {
      const res  = await fetch(`${BACKEND}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });

      const text = await res.text();
      const data = (() => { try { return JSON.parse(text); } catch { throw new Error(text); } })();

      // Save the full JSON for debugging and a short summary for display
      write('OutputJson', JSON.stringify(data, null, 2));
      if (data?.consensus?.final_summary) {
        write('Summary', data.consensus.final_summary);
      } else if (Array.isArray(data?.retrieved)) {
        write('Summary', data.retrieved.map(r => r.text).join('\n\n'));
      } else {
        write('Summary', '');
      }

      setLoading(false);
      return data;
    } catch (err) {
      setLoading(false);
      setError(err.message || String(err));
      write('OutputJson', '');
      throw err;
    }
  }

  async function health() {
    setError('');
    try {
      const r = await fetch(`${BACKEND}/health`);
      const j = await r.json();
      write('HealthOk', j?.ok === true ? 'true' : 'false');
      write('OutputJson', JSON.stringify(j, null, 2));
      return j;
    } catch (e) {
      setError(e.message || String(e));
      throw e;
    }
  }

  // Expose a tiny API that Storyline “Execute JavaScript” triggers can call
  window.PHAGES = { analyze, health };
})();
