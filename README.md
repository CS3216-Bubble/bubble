Bubble

# Getting started

```
git clone
npm install
npm run start
```

## Authentication (TODO)

Authentication happens when creating websocket connection.
If authentication succeeds, the websocket connection is established.
Therefore all subsequent websocket events are considered authenticated.

We can then then user id from request.user via socket.request.

1. Client -> POST to auth endpoint, e.g. `/auth/`
1. Server checks auth parameters, if match -> sets cookies with session id (handled by passportjs)
1. Client -> creates socket.io connection, e.g. `let socket = io()`
1. Server listens to `connection` event, checks `socket.request` for user

## Server Websocket API spec

The spec describes our websocket API that our server exposes.
Each header is an event name, and the payload is data that clients can send.

```
UserId : String
UserName : String
RoomId : String
RoomName : String
RoomDescription: String
UserLimit : Integer
Reason : String
Message : String
Reaction : Integer
Categories : String[]
```

### create_room

Request payload:

```
{
    user: UserId,
    roomName: RoomName,
    roomDescription: RoomDescription,
    userLimit: UserLimit
    categories: Categories
}
```

Emits event `create_room` with payload:

```
{
    roomId: RoomId
}
```

Notes: limit number of rooms a user can create? maybe only 1 at any time?

### join_room

Request payload:

```
{
    roomId: RoomId,
    user: UserId,
}
```

Emits event `join_room` to all users connected to room with payload:

```
{
    roomId: RoomId,
    user: UserId,
}
```

Notes: check if room has capacity for more people to join, is user authorized to join? maybe if the user has been reported we will not let this user join.

### exit_room

```
{
    roomId: RoomId,
    user: UserId,
}
```

Emits event `exit_room` to all users connected to room:

```
{
    roomId: RoomId,
    user: UserId,
}
```

### view_rooms

```
{
    user: UserId
}
```

Response:

```
{
    rooms: [RoomId]
}
```

Notes: see all available rooms, paginate? how to sort?

### typing

Indicate that user is typing

```
{
    roomId: RoomId,
    user: UserId,
}
```

Emits event `typing` to all other users in room:

```
{
    roomId: RoomId,
    user: UserId,
}
```

### stop_typing

indicate that user has stopped typing

```
{
    roomId: RoomId,
    user: UserId,
}
```

Emits event `stop_typing` to all other users in room:

```
{
    roomId: RoomId,
    user: UserId,
}
```

### report_user,

Reports `userToReport` for bad behavior:

```
{
    user: UserId,
    userToReport: UserId,
    roomId: RoomId,
    reason: Reason,
}
```

### add_message

Show message to all connected users

```
{
    roomId: RoomId,
    user: UserId,
    message: Message,
}
```

Emits event `add_message` to all other users in room:

```
{
    user: UserId,
    roomId: RoomId,
    message: Message,
}
```


### add_reaction

Show reaction to all connected users

```
{
    user: UserId,
    roomId: RoomId,
    reaction: Reaction,
}
```

Emits event `add_reaction` to all other users in room:

```
{
    user: UserId,
    roomId: RoomId,
    reaction: Reaction,
}
```

## Server-emitted websocket events

Websocket events that the server will emit to clients.

- `create_room`
- `join_room`
- `exit_room`
- `typing`
- `stop_typing`
- `add_message`
- `add_reaction`
