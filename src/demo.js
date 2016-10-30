(function($, io) {
  var roomId;
  var currentRoom = $('#currentRoom');
  var isCounsellor = false;
  var msgs = $('#messages');
  var msgInput = $('#m');
  var typing = $('#typingindicator');
  var exitRoom = $('#exitroom');
  exitRoom.hide();

  var socket = io();

  socket.on('list_rooms', function(msg) {
    console.log('listing rooms:');
    console.log(msg);
  });

  socket.on('view_room', function(msg) {
    console.log('viewing rooms:');
    console.log(msg);
  });

  socket.on('create_room', function(msg) {
    console.log(`room created ${msg.roomId}`);
    roomId = msg.roomId;
    currentRoom.val(roomId);
    exitRoom.show();
  });

  socket.on('join_room', function(msg) {
    if (socket.id === msg.userId) {
      msgs.append(
        `<li>You have just joined this room.
        There are ${msg.participants.length} people in this room.</li>`
      );
      // same user, do nothing
    } else {
      console.log(`user ${msg.userId} joined this room`);
      msgs.append(
        `<li>${msg.userId} has joined the room</li>`
      );
    }
  });

  socket.on('add_message', function(msg) {
    if (socket.id === msg.userId) {
      // same user, do nothing
    } else {
      console.log(`user ${msg.userId} said "${msg.content}"`);
      msgs.append(
        `<li>${msg.userId}: "${msg.content}"</li>`
      );
    }
  });

  socket.on('typing', function(msg) {
    typing.text(`${msg.userId} is typing`);
  });

  socket.on('stop_typing', function() {
    typing.text('');
  });

  socket.on('counsellor_online', function() {
    $('#conline').text('Online as Counsellor');
  });

  socket.on('find_counsellor', function(data) {
    console.log(data);
    if (isCounsellor) {
      $('#clist').html(`
              Chatting with
              <p>${data.userId}</p>
          `);
    } else {
      $('#clist').html(`
              Chatting with
              <p>${data.counsellorId}</p>
              <p>${data.counsellorName}</p>
          `);
    }

    currentRoom.val(data.roomId);
  });

  socket.on('exit_room', function(data) {
    msgs.append(`<li>${data.userId} exited the room</li>`);
  });

  $('form#list').submit(function() {
    socket.emit('list_rooms');
    return false;
  });

  $('form#create').submit(function() {
    socket.emit('create_room', {
      roomName: $('#roomname').val(),
      roomDescription: 'description',
    });
    return false;
  });

  $('form#join').submit(function() {
    roomId = $('#joinroomid').val();
    socket.emit('join_room', {
      roomId,
    });
    currentRoom.val(roomId);
    exitRoom.show();
    return false;
  });

  $('form#view').submit(function() {
    roomId = $('#viewroomid').val();
    socket.emit('view_room', {
      roomId,
    });
    return false;
  });

  $('form#send').submit(function() {
    const message = msgInput.val();
    socket.emit('add_message', {
      roomId: currentRoom.val(),
      message,
    });
    msgs.append(
      `<li>${socket.id}: "${message}"</li>`
    );
    msgInput.val('');
    return false;
  });

  $('#fc').submit(function() {
    socket.emit('find_counsellor', {});
    return false;
  });

  $('#jac').submit(function() {
    socket.emit('counsellor_online', {
      counsellorId: $('#cid').val(),
      counsellorName: $('#cname').val(),
    });
    isCounsellor = true;
    return false;
  });

  $('#exitroom').submit(function() {
    if (!roomId) {
      return false;
    }
    socket.emit('exit_room', {
      roomId
    });
    currentRoom.val('');
    exitRoom.hide();
    return false;
  });

  $('#setclaimtoken').submit(function() {
    socket.emit('set_claim_token', {
      claimToken: $('#claimtoken').val(),
    });
    return false;
  });

  $('#claimid').submit(function() {
    socket.emit('claim_id', {
      oldSocketId: $('#oldsocketid').val(),
      claimToken: $('#claimtoken').val(),
    });
    return false;
  });

  var kdtimeout;
  msgInput.on('keydown', function() {
    if (!roomId) {
      return;
    }
    if (kdtimeout) {
      clearTimeout(kdtimeout);
    }
    socket.emit('typing', { roomId });
    kdtimeout = setTimeout(function() {
      socket.emit('stop_typing', { roomId });
    }, 500);
  });
})(jQuery, io); // eslint-disable-line no-undef
