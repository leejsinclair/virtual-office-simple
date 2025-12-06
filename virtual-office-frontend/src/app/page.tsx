/**
 * Virtual Office - Main Page Component
 *
 * This is the primary component for the virtual office application.
 * It handles:
 * - User authentication and login
 * - Real-time presence and movement via Socket.IO
 * - Proximity-based group chat
 * - Automatic mesh video conferencing via PeerJS/WebRTC
 * - Office layout rendering with desks, meeting rooms, and kitchen
 *
 * @module Page
 */

"use client";
import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import Peer from "peerjs";

// Backend Socket.IO server URL
const socketURL = "http://localhost:4000";

/**
 * Office layout configuration
 * Defines the positions and dimensions of office elements
 */
const office = {
  // Desk positions (x, y coordinates on the grid)
  desks: [
    { x: 2, y: 2 },
    { x: 2, y: 4 },
    { x: 2, y: 6 },
    { x: 4, y: 2 },
    { x: 4, y: 4 },
    { x: 4, y: 6 },
  ],
  // Meeting rooms with width (w) and height (h)
  meetingRooms: [
    { x: 8, y: 1, w: 3, h: 3, name: "Meeting Room A" },
    { x: 8, y: 5, w: 3, h: 3, name: "Meeting Room B" },
  ],
  // Kitchen area
  kitchen: { x: 1, y: 8, w: 3, h: 2, name: "Kitchen" },
};

// Grid configuration constants
const GRID_SIZE = 40; // Pixel size of each grid square
const GRID_W = 12; // Grid width (number of squares)
const GRID_H = 11; // Grid height (number of squares)

/**
 * Main Page Component
 *
 * Renders the virtual office interface with login, office map, chat, and video features
 */
export default function Page() {
  // ============================================================================
  // Authentication & User State
  // ============================================================================

  /** Current user's username input */
  const [username, setUsername] = useState("");
  /** Whether user has successfully logged in */
  const [entered, setEntered] = useState(false);
  /** Map of other users and their positions: { username: { x, y } } */
  const [others, setOthers] = useState<{ [k: string]: { x: number; y: number } }>({});
  /** Current user's position on the grid */
  const [myPos, setMyPos] = useState({ x: 2, y: 2 });
  /** Socket.IO connection reference */
  const socketRef = useRef<Socket | null>(null);

  // ============================================================================
  // PeerJS/WebRTC Video State
  // ============================================================================

  /** PeerJS instance for WebRTC connections */
  const [peer, setPeer] = useState<any>(null);
  /** PeerJS ID assigned when peer connection opens */
  const [peerId, setPeerId] = useState<string>("");
  /** Local user's media stream (camera + microphone) */
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  /** Map of remote peer video streams: { peerId: MediaStream } */
  const [videoPeers, setVideoPeers] = useState<{ [id: string]: MediaStream }>({});
  /** Map of active video call connections: { peerId: Call } */
  const [videoConnections, setVideoConnections] = useState<{ [id: string]: any }>({});
  /** Ref to track video connections without causing re-renders (prevents flickering) */
  const videoConnectionsRef = useRef<{ [id: string]: any }>({});
  /** Refs to video DOM elements for remote peers */
  const videoRefs = useRef<{ [id: string]: HTMLVideoElement | null }>({});
  /** Ref to local video element in group chat sidebar */
  const localVideoRefForGroup = useRef<HTMLVideoElement | null>(null);

  // Legacy video call state (for one-on-one calls via avatar click)
  /** Username of user being called in legacy video modal */
  const [callUser, setCallUser] = useState<string | null>(null);
  /** Whether legacy video call modal is visible */
  const [videoModal, setVideoModal] = useState(false);
  /** Remote stream for legacy video call */
  const [remoteStream, setRemoteStream] = useState<any>(null);
  /** Ref to local video element in legacy modal */
  const localVideoRef = useRef<HTMLVideoElement>(null);
  /** Ref to remote video element in legacy modal */
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  /** Reference to current legacy video call */
  const currentCallRef = useRef<any>(null);

  // ============================================================================
  // Chat State
  // ============================================================================

  /** Legacy: Map of active chat sessions (deprecated, kept for compatibility) */
  const [activeChats, setActiveChats] = useState<{ [other: string]: boolean }>({});
  /** Legacy: Chat messages per user (deprecated) */
  const [chatMessages, setChatMessages] = useState<{
    [other: string]: { from: string; msg: string }[];
  }>({});
  /** Current group members (users within proximity) */
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  /** Group chat messages */
  const [groupMessages, setGroupMessages] = useState<{ from: string; msg: string }[]>([]);
  /** Current chat input text */
  const [chatInput, setChatInput] = useState<string>("");
  /** Legacy: Currently adjacent user (deprecated) */
  const [adjacentUser, setAdjacentUser] = useState<string | null>(null);

  // ============================================================================
  // PeerJS Initialization
  // ============================================================================

  /**
   * Initialize PeerJS connection when user enters the office
   * Sets up peer-to-peer WebRTC infrastructure for video calls
   */
  useEffect(() => {
    // Only initialize once when user enters
    if (!entered || peer) return;

    // Create new PeerJS instance using username as peer ID
    const _peer = new Peer(username, { debug: 1 });
    setPeer(_peer);

    // When peer connection opens, store the assigned ID
    _peer.on("open", (id) => setPeerId(id));

    // Handle incoming video calls (legacy one-on-one calls)
    _peer.on("call", (call) => {
      // Request user's camera and microphone
      navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
        // Answer the incoming call with local stream
        call.answer(stream);
        setVideoModal(true);
        currentCallRef.current = call;

        // Display local video in modal
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Handle incoming remote video stream
        call.on("stream", (remote: MediaStream) => {
          setRemoteStream(remote);
        });

        // Clean up when call ends
        call.on("close", () => {
          setVideoModal(false);
          setRemoteStream(null);
        });
      });
    });

    // Cleanup: destroy peer connection on unmount
    return () => {
      _peer.destroy();
    };
  }, [entered, peer, username]);

  /**
   * Update remote video element when stream is received (legacy modal)
   */
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  /**
   * Ensure local video is muted in legacy modal (prevent echo)
   */
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.muted = true;
    }
  }, [localVideoRef]);

  // ============================================================================
  // Socket.IO Presence & Movement
  // ============================================================================

  /**
   * Connect to Socket.IO server and handle presence updates
   * Receives real-time updates about all users' positions
   */
  useEffect(() => {
    if (!entered) return;

    // Create Socket.IO connection
    const s = io(socketURL);
    socketRef.current = s;

    // Join the office with username
    s.emit("join", username);

    // Listen for presence updates (all users' positions)
    s.on("presence", (users) => {
      setOthers((all) => ({ ...users }));
      // Update own position if server has it
      if (users[username]) setMyPos(users[username]);
    });

    // Cleanup: disconnect on unmount
    return () => {
      s.disconnect();
    };
  }, [entered, username]);

  /**
   * Handle keyboard input for character movement
   * Arrow keys move the user's avatar on the office grid
   */
  useEffect(() => {
    if (!entered) return;

    const handle = (e: KeyboardEvent) => {
      // Create new position based on current position
      const d = { ...myPos };

      // Handle arrow key presses with boundary checking
      if (e.key === "ArrowUp") d.y = Math.max(0, d.y - 1);
      if (e.key === "ArrowDown") d.y = Math.min(GRID_H - 1, d.y + 1);
      if (e.key === "ArrowLeft") d.x = Math.max(0, d.x - 1);
      if (e.key === "ArrowRight") d.x = Math.min(GRID_W - 1, d.x + 1);

      // Only update if position actually changed
      if (d.x !== myPos.x || d.y !== myPos.y) {
        setMyPos(d);
        // Broadcast movement to server
        socketRef.current?.emit("move", { username, x: d.x, y: d.y });
      }
    };

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [myPos, entered, username]);

  // ============================================================================
  // Legacy Video Call Functions (One-on-One)
  // ============================================================================

  /**
   * Initiate a one-on-one video call with another user
   * Called when clicking on another user's avatar
   *
   * @param other - Username of the user to call
   */
  const initiateCall = async (other: string) => {
    setCallUser(other);
    setVideoModal(true);

    // Request camera and microphone access
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initiate PeerJS call if peer is ready
      if (peer) {
        const call = peer.call(other, stream);
        currentCallRef.current = call;

        // Handle incoming remote stream
        call.on("stream", (remote: MediaStream) => setRemoteStream(remote));

        // Clean up on call end
        call.on("close", () => {
          setVideoModal(false);
          setRemoteStream(null);
        });
      }
    });
  };

  /**
   * End the current video call and clean up resources
   */
  const leaveCall = () => {
    setVideoModal(false);
    setCallUser(null);
    setRemoteStream(null);

    // Close the PeerJS call
    if (currentCallRef.current) {
      currentCallRef.current.close();
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  // ============================================================================
  // Authentication
  // ============================================================================

  /**
   * Handle login form submission
   * Sends username to backend and enters the office
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;

    // Send login request to backend
    await fetch(`${socketURL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    // Mark user as entered (triggers Socket.IO connection)
    setEntered(true);
  };

  // ============================================================================
  // Chat Message Handling
  // ============================================================================

  /**
   * Listen for incoming chat messages (legacy handler)
   * Kept for backward compatibility
   */
  useEffect(() => {
    if (!entered) return;
    const s = socketRef.current;
    if (!s) return;

    const handler = ({ from, to, msg }: { from: string; to: string; msg: string }) => {
      // Determine the other user in the conversation
      const other = from === username ? to : from;
      console.log("[chat] Message received", { from, to, msg, myself: username });

      // Add message to chat history (keep last 8 messages)
      setChatMessages((prev: { [other: string]: { from: string; msg: string }[] }) => ({
        ...prev,
        [other]: [...(prev[other] || []), { from, msg }].slice(-8),
      }));
    };

    s.on("chat", handler);
    return () => {
      s.off("chat", handler);
    };
  }, [entered, username]);

  /**
   * Listen for group chat messages
   * Handles proximity-based group chat messages
   */
  useEffect(() => {
    if (!entered) return;
    const s = socketRef.current;
    if (!s) return;

    const handler = ({ from, msg, group }: { from: string; msg: string; group: string[] }) => {
      // Update group membership from server
      setGroupMembers(group);
      // Add message to group chat (keep last 32 messages)
      setGroupMessages((prev) => [...prev, { from, msg }].slice(-32));
    };

    s.on("chat", handler);
    return () => {
      s.off("chat", handler);
    };
  }, [entered]);

  /**
   * Update group membership based on proximity
   * Polls backend to get current proximity groups
   */
  useEffect(() => {
    if (!entered) {
      // Clear group data when not in office
      setGroupMembers([]);
      setGroupMessages([]);
      return;
    }

    /**
     * Fetch current group membership from backend
     * Groups are calculated based on users within 1 square of each other
     */
    async function fetchGroup() {
      const res = await fetch("http://localhost:4000/api/groups");
      const groups = await res.json();

      // Only show group if there are 2+ members (you + at least one other)
      setGroupMembers(groups[username]?.length > 1 ? groups[username] : []);

      // Clear messages if no longer in a group
      if (!(groups[username]?.length > 1)) setGroupMessages([]);
    }

    fetchGroup();
  }, [others, entered, username]);

  /**
   * Send a group chat message
   * Message is broadcast to all members of the current proximity group
   */
  const sendGroupChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    // Emit chat message to server (server handles group distribution)
    socketRef.current?.emit("chat", { msg: chatInput });
    setChatInput("");
  };

  /**
   * Legacy: Find adjacent user for one-on-one chat
   * Kept for backward compatibility
   */
  useEffect(() => {
    if (!entered) {
      setAdjacentUser(null);
      return;
    }

    // Find first user within 1 square (including diagonals)
    const my = others[username] || myPos;
    const adj = Object.keys(others).find((u) => u !== username && isAdjacent(my, others[u]));
    setAdjacentUser(adj || null);
  }, [myPos, others, username, entered]);

  // ============================================================================
  // Group Video Conferencing (Mesh P2P)
  // ============================================================================

  /**
   * Initialize PeerJS and request media stream for group video
   * Sets up local camera/microphone for group video calls
   */
  useEffect(() => {
    // Only initialize once when user enters
    if (!entered || peer) return;

    // Create PeerJS instance
    const myPeer = new Peer(username, { debug: 1 });
    setPeer(myPeer);

    // Store peer ID when connection opens
    myPeer.on("open", (id) => setPeerId(id));

    // Request camera and microphone access
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      setMediaStream(stream);
    });

    // Cleanup on unmount
    return () => {
      myPeer.destroy();
    };
  }, [entered, peer, username]);

  /**
   * Handle incoming video calls from other group members
   * Answers calls and sets up video streams
   */
  useEffect(() => {
    // Only handle calls when peer is fully initialized
    if (!peer || !mediaStream || !peerId) return;

    let isMounted = true;

    /**
     * Handle incoming PeerJS call
     * @param call - The incoming call object
     */
    const handleCall = (call: any) => {
      if (!isMounted) return;

      // Answer the call with local media stream
      call.answer(mediaStream);

      // Handle incoming remote video stream
      call.on("stream", (remoteStream: MediaStream) => {
        setVideoPeers((peers) => ({ ...peers, [call.peer]: remoteStream }));
      });

      // Clean up when call ends
      call.on("close", () => {
        setVideoPeers((peers) => {
          const np = { ...peers };
          delete np[call.peer];
          return np;
        });
      });

      // Store connection reference
      setVideoConnections((conns) => {
        const updated = { ...conns, [call.peer]: call };
        videoConnectionsRef.current = updated; // Keep ref in sync
        return updated;
      });
    };

    peer.on("call", handleCall);

    // Cleanup
    return () => {
      isMounted = false;
      if (peer) peer.off("call", handleCall);
    };
  }, [peer, mediaStream, peerId]);

  /**
   * Manage mesh video connections for proximity group
   * Automatically connects/disconnects video when users join/leave group
   * Uses mesh topology: each user calls users whose name sorts after theirs
   */
  useEffect(() => {
    // Only proceed if peer is ready
    if (!peer || !mediaStream || !peerId) return;

    // Get current connections from ref (avoids stale closures)
    const currentConnections = videoConnectionsRef.current;

    // If not in a group, close all video connections
    if (groupMembers.length <= 1) {
      // Close all active calls
      Object.values(currentConnections).forEach((call: any) => call.close && call.close());
      setVideoPeers({});
      setVideoConnections({});
      videoConnectionsRef.current = {};
      return;
    }

    // Sort group members to determine who calls whom
    // Each user only calls users whose name sorts after theirs (prevents duplicate connections)
    const sorted = [...groupMembers].sort();
    const myIdx = sorted.indexOf(username);
    const updatedConns: { [id: string]: any } = {};

    // Create outgoing calls to peers we should connect to
    for (let i = 0; i < sorted.length; ++i) {
      const other = sorted[i];
      if (other === username) continue; // Skip self

      // Only call if: peer sorts after us AND we're not already connected
      if (i > myIdx && !currentConnections[other]) {
        try {
          // Initiate PeerJS call
          const call = peer.call(other, mediaStream);
          if (call) {
            // Handle incoming remote stream
            call.on("stream", (remoteStream: MediaStream) => {
              setVideoPeers((peers) => ({ ...peers, [other]: remoteStream }));
            });

            // Clean up on call end
            call.on("close", () => {
              setVideoPeers((peers) => {
                const np = { ...peers };
                delete np[other];
                return np;
              });
              // Remove from ref
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

    // Merge new connections with existing (preserve inbound connections)
    const newConnections = { ...currentConnections, ...updatedConns };
    videoConnectionsRef.current = newConnections;
    setVideoConnections(newConnections);

    // Prune connections for users who left the group
    Object.keys(currentConnections).forEach((id) => {
      if (!groupMembers.includes(id)) {
        // Close connection
        currentConnections[id].close && currentConnections[id].close();
        // Remove from video peers
        setVideoPeers((peers) => {
          const np = { ...peers };
          delete np[id];
          return np;
        });
        delete newConnections[id];
      }
    });

    // Update state if connections changed
    if (Object.keys(newConnections).length !== Object.keys(currentConnections).length) {
      videoConnectionsRef.current = newConnections;
      setVideoConnections(newConnections);
    }
  }, [groupMembers, peer, mediaStream, peerId, username]);

  // ============================================================================
  // Video Element Management
  // ============================================================================

  /**
   * Update local video element when media stream is available
   * Prevents flickering by only updating when stream actually changes
   */
  useEffect(() => {
    if (localVideoRefForGroup.current && mediaStream) {
      // Only update if stream has changed
      if (localVideoRefForGroup.current.srcObject !== mediaStream) {
        localVideoRefForGroup.current.srcObject = mediaStream;
      }
    }
  }, [mediaStream]);

  /**
   * Update remote video elements when streams change
   * Manages video elements for all group members
   */
  useEffect(() => {
    Object.entries(videoPeers).forEach(([peerId, stream]) => {
      const videoEl = videoRefs.current[peerId];
      // Only update if stream has changed (prevents flickering on re-renders)
      if (videoEl && videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
    });
  }, [videoPeers]);

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Legacy chat UI helpers (deprecated)
   */
  const showChat = (other: string) =>
    setActiveChats((chats: { [k: string]: boolean }) => ({ ...chats, [other]: true }));
  const closeChat = (other: string) =>
    setActiveChats((chats: { [k: string]: boolean }) => {
      const c = { ...chats };
      delete c[other];
      return c;
    });

  /**
   * Check if two positions are adjacent (within 1 square, including diagonals)
   *
   * @param a - First position { x, y }
   * @param b - Second position { x, y }
   * @returns true if positions are adjacent
   */
  const isAdjacent = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a" }}>
      {/* Legacy Video Call Modal (one-on-one calls) */}
      {videoModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#1e293b",
              borderRadius: 20,
              padding: 32,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
              border: "2px solid #334155",
            }}
          >
            <h3 style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 700, marginBottom: 20 }}>
              Video Call {callUser ? `with ${callUser}` : ""}
            </h3>
            <div style={{ display: "flex", gap: 16, margin: "12px 0" }}>
              {/* Local video feed */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: 200,
                  borderRadius: 12,
                  background: "#000",
                  border: "2px solid #3b82f6",
                }}
              />
              {/* Remote video feed */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{
                  width: 200,
                  borderRadius: 12,
                  background: "#000",
                  border: "2px solid #10b981",
                }}
              />
            </div>
            <button
              onClick={leaveCall}
              style={{
                marginTop: 20,
                padding: "12px 32px",
                borderRadius: 12,
                fontSize: 16,
                background: "#ef4444",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Leave Call
            </button>
          </div>
        </div>
      )}

      {/* Login Screen */}
      {!entered ? (
        <form
          onSubmit={handleLogin}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            height: "100vh",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f172a",
          }}
        >
          <h2 style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
            Virtual Office
          </h2>
          <input
            value={username}
            maxLength={24}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name..."
            style={{
              fontSize: 18,
              padding: "12px 16px",
              borderRadius: 12,
              border: "2px solid #334155",
              background: "#1e293b",
              color: "#f1f5f9",
              width: 280,
              outline: "none",
            }}
          />
          <button
            disabled={!username}
            style={{
              fontSize: 18,
              borderRadius: 12,
              padding: "12px 32px",
              cursor: !username ? "not-allowed" : "pointer",
              background: !username ? "#334155" : "#3b82f6",
              color: "#ffffff",
              border: "none",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            Enter Office
          </button>
        </form>
      ) : (
        /* Office View */
        <div style={{ display: "flex", flexDirection: "row", height: "100vh" }}>
          {/* Office Grid Map */}
          <div
            style={{
              position: "relative",
              width: GRID_SIZE * GRID_W,
              height: GRID_SIZE * GRID_H,
              background: "#1e293b",
              border: "2px solid #334155",
              margin: 30,
              borderRadius: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* Grid lines for visual reference */}
            {[...Array(GRID_W)].map((_, x) => (
              <div
                key={x}
                style={{
                  position: "absolute",
                  top: 0,
                  left: x * GRID_SIZE,
                  width: 1,
                  height: GRID_SIZE * GRID_H,
                  background: "#334155",
                }}
              />
            ))}
            {[...Array(GRID_H)].map((_, y) => (
              <div
                key={y}
                style={{
                  position: "absolute",
                  left: 0,
                  top: y * GRID_SIZE,
                  height: 1,
                  width: GRID_SIZE * GRID_W,
                  background: "#334155",
                }}
              />
            ))}

            {/* Render desks */}
            {office.desks.map((d, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: d.x * GRID_SIZE,
                  top: d.y * GRID_SIZE,
                  width: GRID_SIZE,
                  height: GRID_SIZE,
                  background: "#1e40af",
                  borderRadius: 8,
                  border: "2px solid #3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontSize: 20,
                }}
              >
                🖥️
              </div>
            ))}

            {/* Render meeting rooms */}
            {office.meetingRooms.map((r, i) => (
              <div
                key={r.name}
                style={{
                  position: "absolute",
                  left: r.x * GRID_SIZE,
                  top: r.y * GRID_SIZE,
                  width: r.w * GRID_SIZE,
                  height: r.h * GRID_SIZE,
                  background: "#065f46",
                  borderRadius: 14,
                  border: "2px solid #10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {r.name}
              </div>
            ))}

            {/* Render kitchen */}
            <div
              style={{
                position: "absolute",
                left: office.kitchen.x * GRID_SIZE,
                top: office.kitchen.y * GRID_SIZE,
                width: office.kitchen.w * GRID_SIZE,
                height: office.kitchen.h * GRID_SIZE,
                background: "#92400e",
                borderRadius: 14,
                border: "2px solid #f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              🍪 {office.kitchen.name}
            </div>

            {/* Render user avatars */}
            {Object.entries(others).map(
              ([user, pos]) =>
                user && (
                  <div
                    key={user}
                    style={{
                      position: "absolute",
                      left: pos.x * GRID_SIZE + 6, // Offset for centering
                      top: pos.y * GRID_SIZE + 6,
                      width: 28,
                      height: 28,
                      // Different colors for self vs others
                      background: user === username ? "#3b82f6" : "#6366f1",
                      border: user === username ? "3px solid #fbbf24" : "3px solid #8b5cf6",
                      borderRadius: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: "bold",
                      fontSize: 16,
                      boxShadow: user !== username ? "0 2px 8px #0003" : undefined,
                      zIndex: 8,
                      cursor: user !== username ? "pointer" : undefined,
                    }}
                    title={user}
                    onClick={user !== username ? () => initiateCall(user) : undefined}
                  >
                    {/* Display first letter of username as avatar */}
                    <span role="img" aria-label="You">
                      {user.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )
            )}
          </div>

          {/* Right Sidebar: Welcome Info & Chat */}
          <div style={{ flex: 1, position: "relative", padding: "40px 30px" }}>
            <h2
              style={{
                marginTop: 0,
                color: "#f1f5f9",
                fontSize: 28,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              Welcome, {username}!
            </h2>
            <p style={{ color: "#cbd5e1", fontSize: 16, marginBottom: 20 }}>
              Use arrow keys to move. Click another character to start a video call.
            </p>
            <ul style={{ color: "#cbd5e1", fontSize: 15, lineHeight: 1.8 }}>
              <li>
                🖥 <strong style={{ color: "#3b82f6" }}>Blue:</strong> Desks
              </li>
              <li>
                🟢 <strong style={{ color: "#10b981" }}>Green:</strong> Meeting rooms
              </li>
              <li>
                🍪 <strong style={{ color: "#f59e0b" }}>Orange:</strong> Kitchen
              </li>
              <li>
                🔵 <strong style={{ color: "#3b82f6" }}>Blue circle:</strong> You
              </li>
              <li>
                🟣 <strong style={{ color: "#6366f1" }}>Purple:</strong> Others
              </li>
            </ul>

            {/* Proximity Group Chat & Video Sidebar */}
            {groupMembers.length > 1 && (
              <div
                style={{
                  position: "fixed",
                  right: 0,
                  top: 0,
                  height: "100vh",
                  width: 340,
                  background: "#1e293b",
                  borderLeft: "2px solid #334155",
                  boxShadow: "-6px 0 32px rgba(0,0,0,0.5)",
                  zIndex: 101,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Chat header with group members */}
                <div
                  style={{
                    padding: "19px 20px",
                    borderBottom: "2px solid #334155",
                    fontWeight: 600,
                    fontSize: 19,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#0f172a",
                    color: "#f1f5f9",
                  }}
                >
                  💬 Nearby chat{" "}
                  <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 10, color: "#94a3b8" }}>
                    {groupMembers.join(", ")}
                  </span>
                </div>

                {/* Video grid: shows all group members' video feeds */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    justifyContent: "flex-start",
                    padding: "12px 12px 0",
                    minHeight: 120,
                    maxHeight: 198,
                    overflowY: "auto",
                  }}
                >
                  {/* Local video (your camera) */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <video
                      ref={localVideoRefForGroup}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: 120, borderRadius: 8, background: "#000" }}
                    />
                    <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600, margin: 2 }}>
                      Me
                    </span>
                  </div>

                  {/* Remote videos (other group members) */}
                  {Object.entries(videoPeers).map(([peerId]) => (
                    <div
                      key={peerId}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
                    >
                      <video
                        ref={(el) => {
                          videoRefs.current[peerId] = el;
                        }}
                        autoPlay
                        playsInline
                        style={{ width: 120, borderRadius: 8, background: "#000" }}
                      />
                      <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600, margin: 2 }}>
                        {peerId}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Chat message history */}
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "20px 16px 10px 16px",
                    fontSize: 15,
                    background: "#0f172a",
                  }}
                >
                  {groupMessages.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        marginBottom: 10,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: m.from === username ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          background: m.from === username ? "#3b82f6" : "#334155",
                          borderRadius: 12,
                          padding: "10px 14px",
                          maxWidth: 220,
                          wordBreak: "break-word",
                        }}
                      >
                        <b
                          style={{
                            fontWeight: 600,
                            fontSize: 13,
                            color: m.from === username ? "#ffffff" : "#fbbf24",
                          }}
                        >
                          {m.from === username ? "Me" : m.from}
                        </b>
                        <br />
                        <span style={{ color: "#f1f5f9" }}>{m.msg}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chat input form */}
                <form
                  style={{
                    padding: 12,
                    display: "flex",
                    gap: 8,
                    borderTop: "2px solid #334155",
                    background: "#0f172a",
                  }}
                  onSubmit={sendGroupChat}
                >
                  <input
                    style={{
                      flex: 1,
                      fontSize: 15,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "2px solid #334155",
                      background: "#1e293b",
                      color: "#f1f5f9",
                      outline: "none",
                    }}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={
                      groupMembers.length > 2
                        ? "Message group..."
                        : `Message ${groupMembers.find((n) => n !== username) || ""}...`
                    }
                    autoFocus
                  />
                  <button
                    type="submit"
                    style={{
                      fontSize: 15,
                      padding: "10px 20px",
                      borderRadius: 10,
                      background: "#3b82f6",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Send
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
