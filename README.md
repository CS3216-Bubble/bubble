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
Payload *must* be sent as a string, for the purposes of this spec,
they are displayed as JSON structures.

```
UserId : String
UserName : String
RoomId : String
RoomName : String
UserLimit : Integer
Reason : String
Message : String
Reaction : Integer
```

### create_room

Request payload:

```
{
    user: UserId,
    room_name: RoomName,
    user_limit: UserLimit
}
```

Emits event `room_created` with payload:

```
{
    room_id: RoomId
}
```

Notes: limit number of rooms a user can create? maybe only 1 at any time?

### join_room

Request payload:

```
{
    user: UserId,
    room: RoomId,
}
```

Emits event `room_joined` to all users connected to room with payload:

```
{
    user: UserId,
}
```

Notes: check if room has capacity for more people to join, is user authorized to join? maybe if the user has been reported we will not let this user join.

### exit_room

```
{
    user: UserId,
    room: RoomId,
}
```

Emits event `room_exited` to all users connected to room:

```
{
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
    user: UserId,
    room: RoomId,
}
```

Emits event `typing` to all other users in room:

```
{
    user: UserId,
}
```

### stop_typing

indicate that user has stopped typing

```
{
    user: UserId,
    room: RoomId,
}
```

Emits event `stop_typing` to all other users in room:

```
{
    user: UserId,
}
```

### report_user,

Reports `user_to_report` for bad behavior:

```
{
    user: UserId,
    user_to_report: UserId,
    room: RoomId,
    reason: Reason,
}
```

### add_message

Show message to all connected users

```
{
    user: UserId,
    room: RoomId,
    message: Message,
}
```

Emits event `add_message` to all other users in room:

```
{
    user: UserId,
    room: RoomId,
    message: Message,
}
```


### add_reaction,

Show reaction to all connected users

```
{
    user: UserId,
    room: RoomId,
    reaction: Reaction,
}
```

Emits event `add_reaction` to all other users in room:

```
{
    user: UserId,
    room: RoomId,
    reaction: Reaction,
}
```

## Server-emitted websocket events

Websocket events that the server will emit to clients.

- `room_created`
- `room_joined`
- `room_exited`
- `typing`
- `stop_typing`
- `add_message`
- `add_reaction`
