/**
 * Real one-to-one audio/video calling.
 *
 * Signaling rides on the shared Supabase broadcast channel (see realtime.ts):
 *   call:ring    caller -> callee   (invite)
 *   call:accept  callee -> caller
 *   call:decline callee -> caller
 *   call:offer   caller -> callee   (SDP)
 *   call:answer  callee -> caller   (SDP)
 *   call:ice     both ways          (trickled candidates)
 *   call:end     both ways
 *
 * ICE servers are configurable so the app is not tied to any single host:
 *   VITE_WEBRTC_ICE_SERVERS = JSON array of RTCIceServer
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { currentUser, currentUserId } from "@/lib/profile-service";
import { emitRealtime, useRealtime } from "@/lib/realtime";
import type { Profile } from "@/lib/types";

export type CallKind = "audio" | "video";
export type CallRole = "caller" | "callee";
export type CallPhase = "ringing" | "connecting" | "connected" | "ended" | "declined" | "failed";

export interface CallSession {
  id: string;
  partner: Profile;
  kind: CallKind;
  role: CallRole;
}

export interface IncomingCall {
  id: string;
  kind: CallKind;
  from: string;
  fromProfile: Profile;
}

function iceServers(): RTCIceServer[] {
  const raw = import.meta.env["VITE_WEBRTC_ICE_SERVERS"] as string | undefined;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as RTCIceServer[];
    } catch {
      /* fall through to defaults */
    }
  }
  return [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    { urls: ["stun:global.stun.twilio.com:3478"] },
  ];
}

export function newCallId() {
  return `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const db = supabase as any;

async function recordCallStart(session: CallSession) {
  if (session.role !== "caller" || currentUserId === "guest") return;
  await db
    .from("calls")
    .insert({
      caller_id: currentUserId,
      callee_id: session.partner.id,
      kind: session.kind,
      status: "ringing",
    })
    .then(() => undefined, () => undefined);
}

async function recordCallEnd(session: CallSession, status: string, durationSeconds: number) {
  if (session.role !== "caller" || currentUserId === "guest") return;
  await db
    .from("calls")
    .update({
      status,
      ended_at: new Date().toISOString(),
      duration_seconds: Math.max(0, Math.round(durationSeconds)),
      ...(durationSeconds > 0 ? { answered_at: new Date(Date.now() - durationSeconds * 1000).toISOString() } : {}),
    })
    .eq("caller_id", currentUserId)
    .eq("callee_id", session.partner.id)
    .eq("status", "ringing")
    .then(() => undefined, () => undefined);
}

/** Listens for invites addressed to the signed-in user. */
export function useIncomingCall() {
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);

  useRealtime(
    {
      "call:ring": (p: any) => {
        if (!p || p.to !== currentUserId || currentUserId === "guest") return;
        setIncoming({
          id: String(p.callId),
          kind: p.kind === "video" ? "video" : "audio",
          from: String(p.from),
          fromProfile: p.fromProfile as Profile,
        });
      },
      "call:end": (p: any) => {
        setIncoming((cur) => (cur && p?.callId === cur.id ? null : cur));
      },
    },
    [],
  );

  const decline = useCallback((call: IncomingCall) => {
    emitRealtime("call:decline", { callId: call.id, to: call.from, from: currentUserId });
    setIncoming(null);
  }, []);

  const dismiss = useCallback(() => setIncoming(null), []);

  return { incoming, decline, dismiss };
}

/** Drives one live peer connection for the given session. */
export function useCallConnection(session: CallSession | null, enabled: boolean) {
  const [phase, setPhase] = useState<CallPhase>("ringing");
  const [seconds, setSeconds] = useState(0);
  const [remoteMuted, setRemoteMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const queuedIce = useRef<RTCIceCandidateInit[]>([]);
  const startedAt = useRef<number | null>(null);
  const cleanedUp = useRef(false);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    const s = sessionRef.current;
    if (!s) return;
    emitRealtime(event, { callId: s.id, to: s.partner.id, from: currentUserId, ...payload });
  }, []);

  const attachRemote = useCallback(() => {
    const stream = remoteStreamRef.current;
    if (!stream) return;
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
      remoteVideoRef.current.srcObject = stream;
      void remoteVideoRef.current.play().catch(() => undefined);
    }
    if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== stream) {
      remoteAudioRef.current.srcObject = stream;
      void remoteAudioRef.current.play().catch(() => undefined);
    }
  }, []);

  const teardown = useCallback(
    (next: CallPhase, status?: string) => {
      if (cleanedUp.current) return;
      cleanedUp.current = true;
      const elapsed = startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      remoteStreamRef.current = null;
      try {
        pcRef.current?.close();
      } catch {
        /* already closed */
      }
      pcRef.current = null;
      setPhase(next);
      const s = sessionRef.current;
      if (s) void recordCallEnd(s, status ?? (elapsed > 0 ? "completed" : "missed"), elapsed);
    },
    [],
  );

  /** Builds the peer connection and local media. */
  const setup = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return null;
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    pcRef.current = pc;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: s.kind === "video",
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const remote = new MediaStream();
    remoteStreamRef.current = remote;

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((t) => {
        if (!remote.getTracks().includes(t)) remote.addTrack(t);
      });
      attachRemote();
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) send("call:ice", { candidate: event.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        if (!startedAt.current) startedAt.current = Date.now();
        setPhase("connected");
        attachRemote();
      } else if (state === "failed") {
        teardown("failed", "failed");
      } else if (state === "disconnected" || state === "closed") {
        teardown("ended");
      }
    };
    return pc;
  }, [attachRemote, send, teardown]);

  const drainIce = useCallback(async (pc: RTCPeerConnection) => {
    while (queuedIce.current.length > 0) {
      const candidate = queuedIce.current.shift()!;
      await pc.addIceCandidate(candidate).catch(() => undefined);
    }
  }, []);

  // Start: caller rings, callee accepts and waits for the offer.
  useEffect(() => {
    if (!enabled || !session) return;
    cleanedUp.current = false;
    setPhase(session.role === "caller" ? "ringing" : "connecting");
    let cancelled = false;

    (async () => {
      try {
        if (session.role === "caller") {
          void recordCallStart(session);
          emitRealtime("call:ring", {
            callId: session.id,
            to: session.partner.id,
            from: currentUserId,
            fromProfile: currentUser,
            kind: session.kind,
          });
        } else {
          const pc = await setup();
          if (cancelled || !pc) return;
          send("call:accept", {});
        }
      } catch (err: any) {
        if (!cancelled) {
          teardown("failed", "failed");
          throw err;
        }
      }
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      const s = sessionRef.current;
      if (s) emitRealtime("call:end", { callId: s.id, to: s.partner.id, from: currentUserId });
      teardown("ended");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, session?.id]);

  // Duration ticker
  useEffect(() => {
    if (phase !== "connected") return;
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useRealtime(
    {
      "call:accept": async (p: any) => {
        const s = sessionRef.current;
        if (!s || p?.callId !== s.id || s.role !== "caller") return;
        setPhase("connecting");
        const pc = pcRef.current ?? (await setup());
        if (!pc) return;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send("call:offer", { sdp: pc.localDescription?.toJSON() });
      },
      "call:offer": async (p: any) => {
        const s = sessionRef.current;
        if (!s || p?.callId !== s.id || s.role !== "callee") return;
        const pc = pcRef.current ?? (await setup());
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
        await drainIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send("call:answer", { sdp: pc.localDescription?.toJSON() });
      },
      "call:answer": async (p: any) => {
        const s = sessionRef.current;
        const pc = pcRef.current;
        if (!s || !pc || p?.callId !== s.id || s.role !== "caller") return;
        await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
        await drainIce(pc);
      },
      "call:ice": async (p: any) => {
        const s = sessionRef.current;
        if (!s || p?.callId !== s.id || !p?.candidate) return;
        const pc = pcRef.current;
        if (!pc || !pc.remoteDescription) {
          queuedIce.current.push(p.candidate);
          return;
        }
        await pc.addIceCandidate(p.candidate).catch(() => undefined);
      },
      "call:decline": (p: any) => {
        const s = sessionRef.current;
        if (!s || p?.callId !== s.id) return;
        teardown("declined", "declined");
      },
      "call:end": (p: any) => {
        const s = sessionRef.current;
        if (!s || p?.callId !== s.id) return;
        teardown("ended");
      },
      "call:media": (p: any) => {
        const s = sessionRef.current;
        if (!s || p?.callId !== s.id) return;
        setRemoteMuted(Boolean(p.muted));
      },
    },
    [session?.id],
  );

  const setMicEnabled = useCallback(
    (on: boolean) => {
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = on;
      });
      send("call:media", { muted: !on });
    },
    [send],
  );

  const setCameraEnabled = useCallback((on: boolean) => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = on;
    });
  }, []);

  /** Replaces the outgoing video track with a screen capture (and back). */
  const shareScreen = useCallback(async (on: boolean) => {
    const pc = pcRef.current;
    if (!pc) return false;
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) return false;
    if (on) {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      if (!track) return false;
      await sender.replaceTrack(track);
      track.onended = () => {
        const camera = localStreamRef.current?.getVideoTracks()[0];
        if (camera) void sender.replaceTrack(camera);
      };
      return true;
    }
    const camera = localStreamRef.current?.getVideoTracks()[0] ?? null;
    await sender.replaceTrack(camera);
    return false;
  }, []);

  const hangUp = useCallback(() => {
    const s = sessionRef.current;
    if (s) emitRealtime("call:end", { callId: s.id, to: s.partner.id, from: currentUserId });
    teardown("ended");
  }, [teardown]);

  return {
    phase,
    seconds,
    remoteMuted,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    setMicEnabled,
    setCameraEnabled,
    shareScreen,
    hangUp,
  };
}
