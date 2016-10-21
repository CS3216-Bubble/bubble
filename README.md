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
UserType: String

RoomId : String
RoomName : String
RoomDescription: String
RoomType: String
UserLimit : Integer
Categories : String[]

Message: {
    messageType: MessageType,
    content : MessageContent,
    createdAt : Date,
    updatedAt : Date,
    userId : UserId,
    roomRoomId : RoomId,
}
MessageContent : String
MessageType: String
ReactionType: String

Reason : String

IssueType: String

Room: {
    RoomId, RoomName, RoomDescription, RoomType, UserLimit, Categories
}
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

And to the newly joined user, we emit `join_room` with a more verbose payload:

```
{
    roomId: RoomId,
    roomId: RoomId,
    roomName: RoomName,
    roomType: RoomType,
    userLimit: UserLimit,
    roomDescription: RoomDescription,
    categories: Categories,
    numUsers: Integer,
    lastActive: Date,
    messages: [Message],
    participants: [UserId]
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

### list_rooms

```
{
    user: UserId
}
```

Response:

```
{
    rooms: [Room]
}
```

Notes: see all available rooms, paginate? how to sort?

### view_room

```
{
    user: UserId,
    roomId: RoomId,
}
```

Response:

```
{
    roomId: RoomId,
    roomName: RoomName,
    roomType: RoomType,
    userLimit: UserLimit,
    roomDescription: RoomDescription,
    categories: Categories,
    numUsers: Integer,
    lastActive: Date,
}
```

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
    message: MessageContent,
}
```

Emits event `add_message` to all other users in room:

```
{
    user: UserId,
    roomId: RoomId,
    message: MessageContent,
}
```

Emits event `add_message` to user who just sent the message

```
{
    user: UserId,
    roomId: RoomId,
    message: MessageContent,
    sentByMe: Boolean,
}
```


### add_reaction

Show reaction to all connected users

```
{
    user: UserId,
    roomId: RoomId,
    reaction: ReactionType,
}
```

Emits event `add_reaction` to all other users in room:

```
{
    user: UserId,
    roomId: RoomId,
    reaction: ReactionType,
}
```

### set_user_name

Sets name for current user

```
{
    userId: UserId,
    newName: String,
}
```

Emits event `set_user_name` to all other users in all rooms user is in

```
{
    userId: UserId,
    newName: UserName,
}
```

### find_counsellor

Tries to find a counsellor for current user

```
{
    userId: UserId,
}
```

Emits event `find_counsellor` if there is a match,
contains information about the counsellor and the private chat room created.

```
{
    counsellorId: String,
    counsellorName: String,
    roomId: RoomId,
    roomName: RoomName,
    roomType: RoomType,
    userLimit: UserLimit,
    roomDescription: RoomDescription,
    categories: Categories,
    numUsers: Integer,
    lastActive: Date,
}
```


## counsellor specific endpoints

These events are used for counsellors only

### counsellor_online

counsellor goes online

```
{
    userId: UserId,
    newName: UserName,
}
```

## Errors

When there are app errors, such as joining a room that is too full,
a `bubble_error` event is emitted to the socket that sent the event
that triggered the error.

All events of such type will have a `code` and a `message`.

`code` specify the type of error,
and `message` is a human readable description of what the error is.

All error codes are specified in `src/error_code.js`.

### NO_MESSAGE

No message specified in `add_message`

### NO_REACTION

No reaction specified in `add_reaction`

### NO_NAME

No name specified in `set_user_name`

### NO_ROOM_ID

No room id specified in events that require an id, such as `join_room` and `add_message`.

### NO_ROOM_NAME

Room name not specified when `create_room`.

### ROOM_FULL

Room is currently full.

### ROOM_ID_NOT_FOUND

Specified room id cannot be found.

### USER_ALREADY_IN_ROOM

User tries to `join_room`, and is already in the room.

### USER_NOT_IN_ROOM

User tries to `add_message` or `add_reaction` to a room user is not in.

### COUNSELLOR_UNAVAILABLE

User `find_counsellor` but no counsellor is online

### NO_USER_TO_REPORT

User `report_user` but no `userToReport` is specified

### ROOM_CLOSED

User `join_room` a room that is closed/empty.
