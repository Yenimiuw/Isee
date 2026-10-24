import { useRef, useState } from 'react';
import { callExtension } from '../extension';

// Shows the tracking notice, arms the extension, then opens the Meet link.
export default function JoinButton({ meeting }) {
  const dlg = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [noExt, setNoExt] = useState(false);

  const openMeet = () => window.open(meeting.meetUrl, '_blank', 'noopener');
  const show = () => { setErr(''); setNoExt(false); dlg.current.showModal(); };

  async function proceed() {
    setBusy(true); setErr(''); setNoExt(false);
    try {
      await callExtension('ping'); // is the extension there? (2.5 s)
    } catch {
      setNoExt(true);
      setErr('The Isee extension did not respond. Install it, log in from its toolbar icon, then try again.');
      setBusy(false);
      return;
    }
    try {
      await callExtension('arm', { meetingId: meeting.id }, 20000); // the server may be slow to wake up
      dlg.current.close();
      openMeet();
    } catch (e) {
      setErr(e.code === 'not-installed' ? 'The extension is taking too long to start tracking. Try again in a moment.' : e.message);
    } finally { setBusy(false); }
  }

  return (
    <>
      <button className="btn" onClick={show}>Join meeting</button>
      <dialog ref={dlg} aria-labelledby={`j-${meeting.id}`}>
        <h2 id={`j-${meeting.id}`}>Before you join</h2>
        <p>While this meeting is open, Isee records when you switch to another tab and the names of the websites you move to. Your educator can see this. Tracking stops when you leave the meeting.</p>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="row wrap">
          <button className="btn" onClick={proceed} disabled={busy}>{busy ? 'Starting…' : 'Continue and join'}</button>
          <button className="btn ghost" onClick={() => dlg.current.close()}>Cancel</button>
        </div>
        {noExt && <button className="link" onClick={() => { dlg.current.close(); openMeet(); }}>Join without tracking (your attendance will not be recorded)</button>}
      </dialog>
    </>
  );
}
