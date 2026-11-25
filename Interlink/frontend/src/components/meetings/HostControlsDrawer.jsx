import React from "react";
import toast from "react-hot-toast";
import { admitParticipant, denyParticipant, endMeeting } from "../../api/meetingApi";

export default function HostControlsDrawer({
    isOpen,
    onClose,
    roomCode,
    meeting,
    waitingParticipants = [],
    activeParticipants = [],
    onAdmitSuccess,
    onDenySuccess,
    onHostAction,
    permissions = { canShareScreen: true, canEditWhiteboard: true, canChat: true },
    onUpdatePermissions
}) {
    if (!isOpen) return null;

    const handleAdmit = async (participantId) => {
        try {
            await admitParticipant(roomCode, participantId);
            toast.success("Participant admitted");
            if (onAdmitSuccess) onAdmitSuccess(participantId);
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to admit participant");
        }
    };

    const handleDeny = async (participantId) => {
        try {
            await denyParticipant(roomCode, participantId);
            toast.success("Participant denied");
            if (onDenySuccess) onDenySuccess(participantId);
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to deny participant");
        }
    };

    const handleAdmitAll = async () => {
        for (const p of waitingParticipants) {
            try {
                await admitParticipant(roomCode, p.id || p.participantId);
            } catch (e) {
                // proceed
            }
        }
        toast.success("Admitted all waiting guests");
        if (onAdmitSuccess) onAdmitSuccess("all");
    };

    const handleMuteAll = () => {
        if (onHostAction) {
            onHostAction("mute_all", null, {});
            toast.success("Requested all participants to mute");
        }
    };

    return (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col text-white animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-950/80">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400">
                        <i className="fa-solid fa-shield-halved text-sm"></i>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white">Host Administration</h2>
                        <p className="text-[11px] text-slate-400">Lobby queue &amp; security governance</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                    <i className="fa-solid fa-xmark text-sm"></i>
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 divide-y divide-white/10">
                {/* 1. Lobby / Waiting Room Queue */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                                Waiting Room Queue
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                {waitingParticipants.length}
                            </span>
                        </div>
                        {waitingParticipants.length > 1 && (
                            <button
                                onClick={handleAdmitAll}
                                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                            >
                                Admit All
                            </button>
                        )}
                    </div>

                    {waitingParticipants.length === 0 ? (
                        <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center text-xs text-slate-400">
                            No participants currently waiting in the lobby.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {waitingParticipants.map((p) => {
                                const pId = p.id || p.participantId;
                                const name = p.display_name || p.guest_name || p.name || "Guest";
                                return (
                                    <div
                                        key={pId}
                                        className="p-2.5 rounded-xl bg-slate-800/80 border border-white/10 flex items-center justify-between gap-2"
                                    >
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-white truncate">{name}</div>
                                            {(p.guest_email || p.display_email) && (
                                                <div className="text-[10px] text-slate-400 truncate">
                                                    {p.guest_email || p.display_email}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                onClick={() => handleAdmit(pId)}
                                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors cursor-pointer"
                                                title="Admit to meeting"
                                            >
                                                Admit
                                            </button>
                                            <button
                                                onClick={() => handleDeny(pId)}
                                                className="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
                                                title="Deny entry"
                                            >
                                                Deny
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 2. Global Actions */}
                <div className="pt-4 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                        Global In-Room Actions
                    </span>

                    <button
                        onClick={handleMuteAll}
                        className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                        <i className="fa-solid fa-microphone-slash text-rose-400"></i>
                        <span>Mute All Participants</span>
                    </button>
                </div>

                {/* 3. In-Meeting Feature Governance */}
                <div className="pt-4 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                        Participant Feature Permissions
                    </span>

                    <div className="space-y-2 text-xs text-slate-300">
                        <label className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
                            <span>Allow Screen Sharing</span>
                            <input
                                type="checkbox"
                                checked={permissions.canShareScreen}
                                onChange={(e) =>
                                    onUpdatePermissions &&
                                    onUpdatePermissions({ ...permissions, canShareScreen: e.target.checked })
                                }
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                        </label>

                        <label className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
                            <span>Allow Whiteboard Collaboration</span>
                            <input
                                type="checkbox"
                                checked={permissions.canEditWhiteboard}
                                onChange={(e) =>
                                    onUpdatePermissions &&
                                    onUpdatePermissions({ ...permissions, canEditWhiteboard: e.target.checked })
                                }
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                        </label>

                        <label className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 cursor-pointer">
                            <span>Allow In-Meeting Text Chat</span>
                            <input
                                type="checkbox"
                                checked={permissions.canChat}
                                onChange={(e) =>
                                    onUpdatePermissions &&
                                    onUpdatePermissions({ ...permissions, canChat: e.target.checked })
                                }
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                        </label>
                    </div>
                </div>

                {/* 4. Active Participants List */}
                <div className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Active Participants ({activeParticipants.length})
                        </span>
                    </div>

                    <div className="space-y-1.5">
                        {activeParticipants.map((p) => {
                            const isHost = p.role === "host";
                            const displayName = p.display_name || p.user_name || p.name || p.guest_name || "Participant";
                            return (
                                <div
                                    key={p.id || p.identity}
                                    className="p-2.5 rounded-xl bg-white/5 flex items-center justify-between gap-2 text-xs"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                            {displayName ? displayName[0].toUpperCase() : "P"}
                                        </div>
                                        <div className="truncate">
                                            <span className="font-semibold text-white">{displayName}</span>
                                            {isHost && (
                                                <span className="ml-1.5 px-1.5 py-0.2 rounded-sm bg-blue-500/20 text-blue-300 text-[9px] font-bold">
                                                    HOST
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {!isHost && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                onClick={() =>
                                                    onHostAction &&
                                                    onHostAction("mute_participant", p.id || p.identity, {})
                                                }
                                                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-rose-600/30 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors"
                                                title="Mute microphone"
                                            >
                                                <i className="fa-solid fa-microphone-slash text-[11px]"></i>
                                            </button>
                                            <button
                                                onClick={() =>
                                                    onHostAction &&
                                                    onHostAction("kick_participant", p.id || p.identity, {})
                                                }
                                                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-rose-600 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                                                title="Remove from room"
                                            >
                                                <i className="fa-solid fa-user-xmark text-[11px]"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
