import { Server } from "socket.io";

const socketAPI = new Server();

socketAPI.on( "connection", function( socket ) {
    console.log( "A user connected" );
});

export default socketAPI;