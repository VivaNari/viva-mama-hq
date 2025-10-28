import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

let io: Server;
export const initSocketIO = (server: HttpServer) => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    io.on("connection", (socket: Socket) => {
        console.log(`New client connected: ${socket.id}`);

        socket.on("custom_event", (data) => {
            console.log(`Received data from ${socket.id}:`, data);

            socket.emit("custom_event_response", { receivedData: data });
        });

        socket.on("disconnect", () => {
            console.log(`Client disconnected: ${socket.id}`);
        });
    });
};

export const getSocketIO = (): Server => {
    return io;
};
