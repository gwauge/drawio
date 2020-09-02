const PORT = process.env.PORT || 9000;

const express = require('express')
const path = require("path")
const utils = require('./utils/utils')

const app = express();
const server = require('http').createServer(app);
const options = {};

const io = require('socket.io')(server, options);

// example room object: {public: true, users: [x, x, x], id: "uuidv4"}
let rooms = {}

// search for uuid
//const room_nsps = io.of(/^\/\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/)
const sample_uuid = "cbb25972-2c5d-4568-9d27-6173711feb59";

io.on("connection", socket => {
    socket.emit("rooms", rooms)

    socket.on("join", payload => {
        //console.log(payload);

        // create room if it doesnt exist yet
        if (!rooms[payload.id]) {
            if (!payload.type || payload.type !== "private") payload.type = "public" // set to public by default
            if (payload.type === "private" && !payload.password) payload.type = "public" // if no password was specified, set type to public

            payload.users = []
            rooms[payload.id] = payload
        }

        // close connection if the password was wrong
        if (rooms[payload.id].type == "private") {
            if (rooms[payload.id].password !== payload.password) {
                socket.emit("wrong password")
                return socket.disconnect(true)
            }
        }

        // join the room
        socket.join(payload.id)
        rooms[payload.id].users.push(socket.id)

        io.emit("rooms", rooms)
    })

    socket.on("message", data => {
        console.log(`'${data.text}' by '${data.origin}'`, Object.values(socket.rooms).filter(room => room != socket.id));
        io
            .to(Object.values(socket.rooms).filter(room => room != socket.id)[0])
            .send(data)
    })

    socket.on("mousedown", coords => {
        socket
            .to(Object.values(socket.rooms).filter(room => room != socket.id)[0])
            .emit("mousedown", coords)
    })

    socket.on("mousemove", coords => {
        socket
            .to(Object.values(socket.rooms).filter(room => room != socket.id)[0])
            .emit("mousemove", coords)
    })

    socket.on("mouseup", coords => {
        socket
            .to(Object.values(socket.rooms).filter(room => room != socket.id)[0])
            .emit("mouseup", coords)
    })

    socket.on("clear", data => {
        socket
            .to(Object.values(socket.rooms).filter(room => room != socket.id)[0])
            .emit("clear", data)
    })

    socket.on("ping", () => {
        socket.emit("pong")
    })

    socket.on("disconnect", () => {
        console.log(`socket '${socket.id}' disconnected.`, rooms)

        for (const roomid in rooms) {
            // if user was in that room
            if (rooms[roomid].users.includes(socket.id)) {
                // remove socket from users
                rooms[roomid].users.splice(rooms[roomid].users.indexOf(socket.id), 1)

                // if room is now empty, delete the room
                if (rooms[roomid].users.length == 0) delete rooms[roomid]

                // update clients
                io.emit("rooms", rooms)
            }
        }
    })
})

app.use(express.static('pages/public'));

// send room files
app.get('/room/main.css', (req, res) => res.sendFile(path.join(__dirname, "pages", "room", "main.css")))
app.get('/room/main.js', (req, res) => res.sendFile(path.join(__dirname, "pages", "room", "main.js")))
app.get('/room/:room_id', (req, res) => {
    //console.log(req.params)
    res.sendFile(path.join(__dirname, "pages", "room", "index.html"))
})

// API -------------------------------------------------------

app.get('/api/uuid', async (req, res) => {
    res.send(await utils.getUUID())
})

app.get('/api/public_rooms', (req, res) => {
    res.json(rooms.filter(room => room.public))
})

app.get('/api/create_room', async (req, res) => {
    const uuid = await utils.getUUID()

    const room = {
        id: uuid,
        users: []
    }

    if (req.query.type == "private") room.public = false
    else room.public = true

    rooms.push(room)

    res.json(room)
})

server.listen(PORT, () => console.log(`Listening on port ${PORT}...`));