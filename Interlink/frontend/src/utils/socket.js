import { io } from "socket.io-client";

let socketInstance = null;
let currentSocketUserId = null;

export const getSocket = () => {
    let backendUrl = import.meta.env.VITE_SOCKET_URL;
    if (!backendUrl) {
        const apiUrl = import.meta.env.VITE_API_URL;
        if (apiUrl && apiUrl.startsWith("http")) {
            try {
                backendUrl = new URL(apiUrl).origin;
            } catch (e) {
                backendUrl = null;
            }
        }
    }
    if (!backendUrl) {
        backendUrl = typeof window !== "undefined" ? (window.location.port === "5174" || window.location.port === "5173" ? "http://localhost:5000" : window.location.origin) : "http://localhost:5000";
    }

    let userId = "";
    try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        userId = user?.id ? String(user.id) : "";
    } catch (e) {
        userId = "";
    }

    if (socketInstance) {
        if (currentSocketUserId !== userId) {
            socketInstance.disconnect();
            socketInstance = null;
        } else {
            if (userId) {
                if (socketInstance.connected) {
                    socketInstance.emit("user:online", String(userId));
                }
            }
            return socketInstance;
        }
    }

    currentSocketUserId = userId;

    socketInstance = io(backendUrl, {
        transports: ["polling", "websocket"],
        upgrade: true,
        query: {
            userId: userId ? String(userId) : ""
        },
        auth: {
            userId: userId ? String(userId) : ""
        },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 5000,
        timeout: 20000
    });

    socketInstance.on("connect_error", (err) => {
        // Prevent flood of console errors when socket proxy is reconnecting
        if (import.meta.env.DEV) {
            console.debug("Socket connection pending:", err?.message || err);
        }
    });

    socketInstance.on("connect", () => {
        let currentUid = "";
        try {
            const activeUser = JSON.parse(localStorage.getItem("user") || "{}");
            currentUid = activeUser?.id ? String(activeUser.id) : "";
        } catch (_) {}

        if (currentUid) {
            socketInstance.emit("user:online", currentUid);
        }
        socketInstance.emit("users:get_online");
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("socket:reconnected"));
        }
    });

    socketInstance.on("disconnect", (reason) => {
        console.log("Disconnected from Chat Socket:", reason);
    });

    return socketInstance;
};

if (typeof window !== "undefined") {
    window.addEventListener("auth-change", () => {
        disconnectSocket();
    });
}

export const disconnectSocket = () => {
    if (socketInstance) {
        try {
            const activeUser = JSON.parse(localStorage.getItem("user") || "{}");
            if (activeUser?.id) {
                socketInstance.emit("user:offline", activeUser.id);
            }
        } catch (e) { /* ignore */ }
        socketInstance.disconnect();
        socketInstance = null;
        currentSocketUserId = null;
    }
};
