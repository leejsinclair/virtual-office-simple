"use client";
import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import Peer from "peerjs";

const socketURL = "http://localhost:4000";

const office = {
  desks: [
    { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 2, y: 6 },
    { x: 4, y: 2 }, { x: 4, y: 4 }, { x: 4, y: 6 },
  ],
  meetingRooms: [
    { x: 8, y: 1, w: 3, h: 3, name: "Meeting Room A" },
    { x: 8, y: 5, w: 3, h: 3, name: "Meeting Room B" }
  ],
  kitchen: { x: 1, y: 8, w: 3, h: 2, name: "Kitchen" }
};

const GRID_SIZE = 40;
const GRID_W = 12;
const GRID_H = 11;

export default function Page() {
  const [username, setUsername] = useState("");
  const [entered, setEntered] = useState(false);
  const [others, setOthers] = useState<{ [k: string]: { x: number; y: number } }>({});
  const [myPos, setMyPos] = useState({ x: 2, y: 2 });
  const socketRef = useRef<Socket | null>(null);
  // --- Peer/video state ---
  const [peer, setPeer] = useState<any>(null);
  const [peerId, setPeerId] = useState<string>("");
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [videoPeers, setVideoPeers] = useState<{ [id: string]: MediaStream }>({});
  const [videoConnections, setVideoConnections] = useState<{ [id: string]: any }>({});
  const videoConnectionsRef = useRef<{ [id: string]: any }>({});
  const videoRefs = useRef<{ [id: string]: HTMLVideoElement | null }>({});
  const localVideoRefForGroup = useRef<HTMLVideoElement | null>(null);
  const [callUser, setCallUser] = useState<string | null>(null);
  const [videoModal, setVideoModal] = useState(false);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const currentCallRef = useRef<any>(null);
  // --- Chat state ---
  const [activeChats, setActiveChats] = useState<{ [other: string]: boolean }>({});
  const [chatMessages, setChatMessages] = useState<{ [other: string]: { from: string, msg: string }[] }>({});
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [groupMessages, setGroupMessages] = useState<{ from: string, msg: string }[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [adjacentUser, setAdjacentUser] = useState<string | null>(null);

  // PeerJS setup
  useEffect(() => {
    if (!entered || peer) return;
    const _peer = new Peer(username, { debug: 1 });
    setPeer(_peer);
    _peer.on("open", (id) => setPeerId(id));
    _peer.on("call", (call) => {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
        call.answer(stream);
        setVideoModal(true);
        currentCallRef.current = call;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        call.on("stream", (remote: MediaStream) => {
          setRemoteStream(remote);
        });
        call.on("close", () => {
          setVideoModal(false);
          setRemoteStream(null);
        });
      });
    });
    return () => {
      _peer.destroy();
    };
  }, [entered, peer, username]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.muted = true;
    }
  }, [localVideoRef]);

  // Socket.io presence
  useEffect(() => {
    if (!entered) return;
    const s = io(socketURL);
    socketRef.current = s;
    s.emit("join", username);
    s.on("presence", (users) => {
      setOthers((all) => ({ ...users }));
      if (users[username]) setMyPos(users[username]);
    });
    return () => { s.disconnect(); };
  }, [entered, username]);

  useEffect(() => {
    if (!entered) return;
    const handle = (e: KeyboardEvent) => {
      let d = { ...myPos };
      if (e.key === "ArrowUp") d.y = Math.max(0, d.y - 1);
      if (e.key === "ArrowDown") d.y = Math.min(GRID_H - 1, d.y + 1);
      if (e.key === "ArrowLeft") d.x = Math.max(0, d.x - 1);
      if (e.key === "ArrowRight") d.x = Math.min(GRID_W - 1, d.x + 1);
      if (d.x !== myPos.x || d.y !== myPos.y) {
        setMyPos(d);
        socketRef.current?.emit("move", { username, x: d.x, y: d.y });
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [myPos, entered, username]);

  // Video call initiation
  const initiateCall = async (other: string) => {
    setCallUser(other);
    setVideoModal(true);
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      if (peer) {
        const call = peer.call(other, stream);
        currentCallRef.current = call;
        call.on("stream", (remote: MediaStream) => setRemoteStream(remote));
        call.on("close", () => {
          setVideoModal(false);
          setRemoteStream(null);
        });
      }
    });
  };

  const leaveCall = () => {
    setVideoModal(false);
    setCallUser(null);
    setRemoteStream(null);
    if (currentCallRef.current) {
      currentCallRef.current.close();
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;
    await fetch(`${socketURL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
    setEntered(true);
  };

  // Listen for chat messages
  useEffect(() => {
    if (!entered) return;
    const s = socketRef.current;
    if (!s) return;
    const handler = ({ from, to, msg }: { from: string, to: string, msg: string }) => {
      const other = from === username ? to : from;
      console.log('[chat] Message received', { from, to, msg, myself: username });
      setChatMessages((prev: { [other: string]: { from: string, msg: string }[] }) => ({
        ...prev,
        [other]: [...(prev[other] || []), { from, msg }].slice(-8) // last 8 messages only
      }));
    };
    s.on("chat", handler);
    return () => { s.off("chat", handler); };
  }, [entered, username]);

  // Listen for chat messages for group
  useEffect(() => {
    if (!entered) return;
    const s = socketRef.current;
    if (!s) return;
    const handler = ({ from, msg, group }: { from: string, msg: string, group: string[] }) => {
      setGroupMembers(group);
      setGroupMessages((prev) => [...prev, { from, msg }].slice(-32)); // last 32
    };
    s.on("chat", handler);
    return () => { s.off("chat", handler); };
  }, [entered]);

  // Update group membership on movement/presence change
  useEffect(() => {
    if (!entered) {
      setGroupMembers([]);
      setGroupMessages([]);
      return;
    }
    // Periodically poll for group membership by proximity (optional: can call every time 'others' changes)
    async function fetchGroup() {
      const res = await fetch("http://localhost:4000/api/groups");
      const groups = await res.json();
      setGroupMembers(groups[username]?.length > 1 ? groups[username] : []);
      if (!(groups[username]?.length > 1)) setGroupMessages([]); // Clear thread if no group
    }
    fetchGroup();
  }, [others, entered, username]);

  const sendGroupChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current?.emit('chat', { msg: chatInput });
    setChatInput("");
  };

  // Remove chat if user moves away
  useEffect(() => {
    if (!entered) { setAdjacentUser(null); return; }
    // Find an adjacent user (excluding yourself)
    const my = others[username] || myPos;
    const adj = Object.keys(others).find(
      u => u !== username && isAdjacent(my, others[u])
    );
    setAdjacentUser(adj || null);
  }, [myPos, others, username, entered]);

  // Setup/teardown PeerJS for local user
  useEffect(() => {
    if (!entered || peer) return;
    const myPeer = new Peer(username, { debug: 1 });
    setPeer(myPeer);
    myPeer.on("open", (id) => setPeerId(id));

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      setMediaStream(stream);
    });

    return () => {
      myPeer.destroy();
    };
  }, [entered, peer, username]);

  // Handle incoming video calls
  useEffect(() => {
    if (!peer || !mediaStream || !peerId) return; // Only handle calls when peer is open
    let isMounted = true;
    const handleCall = (call: any) => {
      if (!isMounted) return;
      call.answer(mediaStream);
      call.on("stream", (remoteStream: MediaStream) => {
        setVideoPeers(peers => ({ ...peers, [call.peer]: remoteStream }));
      });
      call.on("close", () => {
        setVideoPeers(peers => {
          const np = { ...peers }; delete np[call.peer]; return np;
        });
      });
      setVideoConnections(conns => {
        const updated = { ...conns, [call.peer]: call };
        videoConnectionsRef.current = updated;
        return updated;
      });
    };
    peer.on("call", handleCall);
    return () => { 
      isMounted = false;
      if (peer) peer.off("call", handleCall);
    };
  }, [peer, mediaStream, peerId]);

  // Handle group mesh connections (make outgoing calls)
  useEffect(() => {
    if (!peer || !mediaStream || !peerId) return; // Add peerId check - peer must be open
    const currentConnections = videoConnectionsRef.current;
    
    if (groupMembers.length <= 1) {
      // Leaving group: close all peers/conns
      Object.values(currentConnections).forEach((call: any) => call.close && call.close());
      setVideoPeers({});
      setVideoConnections({});
      videoConnectionsRef.current = {};
      return;
    }

    // For a sorted list, only call peers whose name is after me
    const sorted = [...groupMembers].sort();
    const myIdx = sorted.indexOf(username);
    let updatedConns: { [id: string]: any } = {};
    for (let i = 0; i < sorted.length; ++i) {
      const other = sorted[i];
      if (other === username) continue;
      if (i > myIdx && !currentConnections[other]) {
        // Only call if the peer sorts after me and not connected yet
        // Peer is open if peerId exists
        try {
          const call = peer.call(other, mediaStream);
          if (call) {
            call.on("stream", (remoteStream: MediaStream) => {
              setVideoPeers(peers => ({ ...peers, [other]: remoteStream }));
            });
            call.on("close", () => {
              setVideoPeers(peers => {
                const np = { ...peers }; delete np[other]; return np;
              });
              // Remove from ref when closed
              const conns = videoConnectionsRef.current;
              delete conns[other];
              setVideoConnections({ ...conns });
            });
            updatedConns[other] = call;
          }
        } catch (err) {
          console.warn(`Failed to call ${other}:`, err);
        }
      }
    }
    // Don't lose any inbound connections (may or may not call us)
    const newConnections = { ...currentConnections, ...updatedConns };
    videoConnectionsRef.current = newConnections;
    setVideoConnections(newConnections);
    
    // Prune closed peers if group shrank
    Object.keys(currentConnections).forEach(id => {
      if (!groupMembers.includes(id)) {
        currentConnections[id].close && currentConnections[id].close();
        setVideoPeers(peers => {
          const np = { ...peers }; delete np[id]; return np;
        });
        delete newConnections[id];
      }
    });
    if (Object.keys(newConnections).length !== Object.keys(currentConnections).length) {
      videoConnectionsRef.current = newConnections;
      setVideoConnections(newConnections);
    }
  }, [groupMembers, peer, mediaStream, peerId, username]);

  // Update local video element when mediaStream changes
  useEffect(() => {
    if (localVideoRefForGroup.current && mediaStream) {
      if (localVideoRefForGroup.current.srcObject !== mediaStream) {
        localVideoRefForGroup.current.srcObject = mediaStream;
      }
    }
  }, [mediaStream]);

  // Update remote video elements when streams change
  useEffect(() => {
    Object.entries(videoPeers).forEach(([peerId, stream]) => {
      const videoEl = videoRefs.current[peerId];
      if (videoEl && videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
    });
  }, [videoPeers]);

  // UI rendering helpers
  const showChat = (other: string) => setActiveChats((chats: { [k: string]: boolean }) => ({ ...chats, [other]: true }));
  const closeChat = (other: string) => setActiveChats((chats: { [k: string]: boolean }) => {
    const c = { ...chats }; delete c[other]; return c;
  });

  // Send chat
  const isAdjacent = (a: { x: number, y: number }, b: { x: number, y: number }) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a" }}>
      {/* Video Modal */}
      {videoModal && (
        <div style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',background:'rgba(0,0,0,0.8)',display:'flex',justifyContent:'center',alignItems:'center',zIndex:1000}}>
          <div style={{background:'#1e293b',borderRadius:20,padding:32,display:'flex',flexDirection:'column',alignItems:'center',boxShadow:'0 20px 60px rgba(0,0,0,0.7)',border:'2px solid #334155'}}>
            <h3 style={{color:'#f1f5f9',fontSize:24,fontWeight:700,marginBottom:20}}>Video Call {callUser ? `with ${callUser}` : ''}</h3>
            <div style={{display:'flex',gap:16,margin:'12px 0'}}>
              <video ref={localVideoRef} autoPlay playsInline muted style={{width:200,borderRadius:12,background:'#000',border:'2px solid #3b82f6'}} />
              <video ref={remoteVideoRef} autoPlay playsInline style={{width:200,borderRadius:12,background:'#000',border:'2px solid #10b981'}} />
            </div>
            <button onClick={leaveCall} style={{marginTop:20,padding:'12px 32px',borderRadius:12,fontSize:16,background:'#ef4444',color:'#ffffff',border:'none',fontWeight:600,cursor:'pointer'}}>
              Leave Call
            </button>
          </div>
        </div>
      )}
      {!entered ? (
        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: 16, height: "100vh", alignItems: "center", justifyContent: "center", background: "#0f172a" }}
        >
          <h2 style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Virtual Office</h2>
          <input
            value={username}
            maxLength={24}
            onChange={e => setUsername(e.target.value)}
            placeholder="Enter your name..."
            style={{ fontSize: 18, padding: "12px 16px", borderRadius: 12, border: "2px solid #334155", background: "#1e293b", color: "#f1f5f9", width: 280, outline: "none" }}
          />
          <button disabled={!username} style={{ fontSize: 18, borderRadius: 12, padding: "12px 32px", cursor: !username ? "not-allowed" : "pointer", background: !username ? "#334155" : "#3b82f6", color: "#ffffff", border: "none", fontWeight: 600, transition: "all 0.2s" }}>
            Enter Office
          </button>
        </form>
      ) : (
        <div style={{ display: "flex", flexDirection: "row", height: "100vh" }}>
          <div style={{ position: "relative", width: GRID_SIZE * GRID_W, height: GRID_SIZE * GRID_H, background: "#1e293b", border: "2px solid #334155", margin: 30, borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            {[...Array(GRID_W)].map((_, x) => <div key={x} style={{position:'absolute',top:0,left:x*GRID_SIZE,width:1,height:GRID_SIZE*GRID_H,background:'#334155'}} />)}
            {[...Array(GRID_H)].map((_, y) => <div key={y} style={{position:'absolute',left:0,top:y*GRID_SIZE,height:1,width:GRID_SIZE*GRID_W,background:'#334155'}} />)}
            {office.desks.map((d, i) => (
              <div key={i} style={{ position: 'absolute', left: d.x * GRID_SIZE, top: d.y * GRID_SIZE, width: GRID_SIZE, height: GRID_SIZE, background: '#1e40af', borderRadius: 8, border: '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color:'#ffffff', fontSize: 20 }}>🖥️</div>
            ))}
            {office.meetingRooms.map((r, i) => (
              <div key={r.name} style={{ position: 'absolute', left: r.x * GRID_SIZE, top: r.y * GRID_SIZE, width: r.w * GRID_SIZE, height: r.h * GRID_SIZE, background: '#065f46', borderRadius: 14, border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color:'#ffffff', fontWeight: 600, fontSize: 13 }}>{r.name}</div>
            ))}
            <div style={{ position: 'absolute', left: office.kitchen.x * GRID_SIZE, top: office.kitchen.y * GRID_SIZE, width: office.kitchen.w * GRID_SIZE, height: office.kitchen.h * GRID_SIZE, background: '#92400e', borderRadius: 14, border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color:'#ffffff', fontWeight: 600, fontSize: 13 }}>🍪 {office.kitchen.name}</div>
            {Object.entries(others).map(([user, pos]) => (
              user && (
                <div
                  key={user}
                  style={{
                    position: 'absolute',
                    left: pos.x * GRID_SIZE + 6,
                    top: pos.y * GRID_SIZE + 6,
                    width: 28, height: 28,
                    background: user === username ? '#3b82f6' : '#6366f1',
                    border: user === username ? '3px solid #fbbf24' : '3px solid #8b5cf6',
                    borderRadius: 24,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 'bold', fontSize: 16, boxShadow: user !== username ? '0 2px 8px #0003' : undefined,
                    zIndex: 8,
                    cursor: user !== username ? 'pointer' : undefined
                  }}
                  title={user}
                  onClick={user !== username ? ()=>initiateCall(user) : undefined}
                >
                  <span role="img" aria-label="You">{user.charAt(0).toUpperCase()}</span>
                </div>
              )
            ))}
          </div>
          <div style={{ flex: 1, position: "relative", padding: "40px 30px" }}>
            <h2 style={{marginTop:0, color: "#f1f5f9", fontSize: 28, fontWeight: 700, marginBottom: 12}}>Welcome, {username}!</h2>
            <p style={{color: "#cbd5e1", fontSize: 16, marginBottom: 20}}>Use arrow keys to move. Click another character to start a video call.</p>
            <ul style={{color: "#cbd5e1", fontSize: 15, lineHeight: 1.8}}>
              <li>🖥 <strong style={{color: "#3b82f6"}}>Blue:</strong> Desks</li>
              <li>🟢 <strong style={{color: "#10b981"}}>Green:</strong> Meeting rooms</li>
              <li>🍪 <strong style={{color: "#f59e0b"}}>Orange:</strong> Kitchen</li>
              <li>🔵 <strong style={{color: "#3b82f6"}}>Blue circle:</strong> You</li>
              <li>🟣 <strong style={{color: "#6366f1"}}>Purple:</strong> Others</li>
            </ul>
            {/* Chat Sidebar */}
            {groupMembers.length > 1 && (
              <div style={{position:'fixed',right:0,top:0,height:'100vh',width:340,background:'#1e293b',borderLeft:'2px solid #334155',boxShadow:'-6px 0 32px rgba(0,0,0,0.5)',zIndex:101,display:'flex',flexDirection:'column'}}>
                <div style={{padding:'19px 20px',borderBottom:'2px solid #334155',fontWeight:600,fontSize:19,display:'flex',alignItems:'center',gap:10,background:'#0f172a',color:'#f1f5f9'}}>
                  💬 Nearby chat <span style={{fontSize:14,fontWeight:400,marginLeft:10,color:'#94a3b8'}}>{groupMembers.join(', ')}</span>
                </div>
                {/* Video grid */}
                <div style={{display:'flex',flexWrap:'wrap',gap:12,justifyContent:'flex-start',padding:'12px 12px 0',minHeight:120,maxHeight:198,overflowY:'auto'}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                    <video 
                      ref={localVideoRefForGroup} 
                      autoPlay 
                      playsInline 
                      muted 
                      style={{width:120,borderRadius:8,background:'#000'}} 
                    />
                    <span style={{fontSize:12,color:'#cbd5e1',fontWeight:600,margin:2}}>Me</span>
                  </div>
                  {Object.entries(videoPeers).map(([peerId]) => (
                    <div key={peerId} style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                      <video 
                        ref={el => { videoRefs.current[peerId] = el; }}
                        autoPlay 
                        playsInline 
                        style={{width:120,borderRadius:8,background:'#000'}} 
                      />
                      <span style={{fontSize:12,color:'#cbd5e1',fontWeight:600,margin:2}}>{peerId}</span>
                    </div>
                  ))}
                </div>
                <div style={{flex:1,overflowY:'auto',padding:'20px 16px 10px 16px',fontSize:15,background:'#0f172a'}}>
                  {groupMessages.map((m,i)=>(
                    <div key={i} style={{marginBottom:10,display:'flex',flexDirection:'column',alignItems:m.from===username?'flex-end':'flex-start'}}>
                      <div style={{background:m.from===username?'#3b82f6':'#334155',borderRadius:12,padding:'10px 14px',maxWidth:220,wordBreak:'break-word'}}>
                        <b style={{fontWeight:600,fontSize:13,color:m.from===username?'#ffffff':'#fbbf24'}}>{m.from===username?'Me':m.from}</b><br/><span style={{color:'#f1f5f9'}}>{m.msg}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <form style={{padding:12,display:'flex',gap:8,borderTop:'2px solid #334155',background:'#0f172a'}} onSubmit={sendGroupChat}>
                  <input style={{flex:1,fontSize:15,padding:'10px 14px',borderRadius:10,border:'2px solid #334155',background:'#1e293b',color:'#f1f5f9',outline:'none'}} value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder={groupMembers.length > 2 ? "Message group..." : `Message ${groupMembers.find(n=>n!==username)||''}...`} autoFocus />
                  <button type='submit' style={{fontSize:15,padding:'10px 20px',borderRadius:10,background:'#3b82f6',color:'#ffffff',border:'none',fontWeight:600,cursor:'pointer'}}>Send</button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
