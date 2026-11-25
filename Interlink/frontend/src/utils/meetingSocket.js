import { io } from "socket.io-client";

export const getMeetingSocket = () => {
    const token = localStorage.getItem("token");
    const socketUrl = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace("/api", "")
        : "http://localhost:5000";

    return io(socketUrl, {
        auth: { token },
        withCredentials: true,
        transports: ["websocket", "polling"]
    });
};
