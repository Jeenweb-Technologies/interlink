import { io } from "socket.io-client";

export const getMeetingSocket = () => {
    const token = localStorage.getItem("token");
    const socketUrl = import.meta.env.VITE_SOCKET_URL
        || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "") : null)
        || "https://interlink.jeenhost.in";
    const socketPath = import.meta.env.VITE_SOCKET_PATH || "/api/socket.io";

    return io(socketUrl, {
        path: socketPath,
        auth: { token },
        withCredentials: true,
        transports: ["polling", "websocket"],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        timeout: 20000
    });
};
