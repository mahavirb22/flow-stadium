import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function GroupPanel({ groupId, currentUid, eventId }) {
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'groups', groupId),
      (snap) => {
        if (snap.exists()) {
          setGroup({ id: snap.id, ...snap.data() });
        } else {
          setGroup(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('[GroupPanel] Listener error:', err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [groupId]);

  const handleShareLocation = async () => {
    if (!group || !currentUid || sharing) return;
    setSharing(true);
    try {
      const updatedMembers = (group.members || []).map((m) =>
        m.uid === currentUid ? { ...m, nearExit: true } : m
      );
      await updateDoc(doc(db, 'groups', groupId), { members: updatedMembers });
    } catch (err) {
      console.error('[GroupPanel] Failed to update:', err.message);
    } finally {
      setSharing(false);
    }
  };

  if (loading || !group) {
    return (
      <div className="bg-surface-container-low rounded-3xl p-6 flex flex-col justify-between border border-outline-variant/10 min-h-[160px] animate-pulse">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-secondary">Your Group</h3>
          <span className="material-symbols-outlined text-primary text-xl">group</span>
        </div>
      </div>
    );
  }

  const members = group.members || [];
  const currentMember = members.find((m) => m.uid === currentUid);
  const isAlreadyNearExit = currentMember?.nearExit === true;

  // Distribute generic avatars just for UI mapping since actual profiles aren't in Firebase mock
  const MOCK_AVATARS = [
    '/images/sarah.jpg',
    '/images/david.jpg',
    '/images/profile.jpg'
  ];

  return (
    <div className="bg-surface-container-low rounded-3xl p-6 flex flex-col justify-between border border-outline-variant/10 min-h-[160px]">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-secondary">Your Group ({members.length})</h3>
        {group.meetingNudgeSent && group.chosenGate ? (
           <div className="text-xs font-bold text-primary flex items-center gap-1 animate-pulse">
             <span className="material-symbols-outlined text-sm">location_on</span> Meeting @ {group.chosenGate}
           </div>
        ) : (
          <span className="material-symbols-outlined text-primary text-xl">group</span>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {members.map((member, i) => (
          <div key={member.uid} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-surface-variant">
                <img 
                  alt={member.name} 
                  className="w-full h-full object-cover" 
                  src={MOCK_AVATARS[i % MOCK_AVATARS.length]} 
                />
              </div>
              <span className="text-sm font-semibold">
                {member.name || member.uid} {member.uid === currentUid && '(you)'}
              </span>
            </div>
            {member.nearExit ? (
              <span className="text-[10px] font-bold px-2 py-1 bg-tertiary/10 text-tertiary rounded-md uppercase">Concourse</span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-1 bg-primary/10 text-primary rounded-md uppercase">At Seat</span>
            )}
          </div>
        ))}
      </div>
      {!isAlreadyNearExit && (
        <button onClick={handleShareLocation} disabled={sharing} className="mt-4 w-full bg-white text-secondary text-xs font-bold py-2 px-4 rounded-xl border border-outline-variant/20 hover:bg-surface-container-lowest transition-colors">
          📍 Share Location
        </button>
      )}
    </div>
  );
}
