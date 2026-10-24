import { useRef, useState } from 'react';
import { api } from '../api';
import { callExtension } from '../extension';

// Shows the tracking notice, arms the extension, then opens the Meet link.
export default function JoinButton({ meeting }) {
  const dlg = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [noExt, setNoExt] = useState(false);

  const openMeet = () => window.open(meeting.meetUrl, '_blank', 'noopener');
  const show = () => {
    setErr(''); setNoExt(false);
    dlg.current.showModal();
    api('/api/health').catch(() => {}); // wakes the server while the student reads the notice
  };

  async function proceed() {
    setBusy(true); setErr(''); setNoExt(false);
    try {
      await callExtension('ping'); // is the extension on this page?
    } catch {
      setNoExt(true);
      setErr('The Isee extension was not found on this page. Make sure it is enabled, reload this page, then try again.');
      setBusy(false);
      return;
    }
    try {
      await callExtension('arm', { meetingId: meeting.id }, 25000); // the server may be slow to wake up
      dlg.current.close();
      openMeet();
    } catch (e) {
      setErr(e.code === 'not-installed' ? 'The server took too long to answer. Try again in a moment.' : e.message);
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
