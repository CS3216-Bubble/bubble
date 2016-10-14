(function($, io) {
  var roomId;
  var currentRoom = $('#currentRoom');
  var isCounsellor = false;

  var socket = io();

  socket.on('list_rooms', function(msg) {
    console.log('listing rooms:');
    console.log(msg);
  });

  socket.on('create_room', function(msg) {
    console.log(`room created ${msg.roomId}`);
    roomId = msg.roomId;
    currentRoom.text(roomId);
  });

  socket.on('join_room', function(msg) {
    console.log(`user ${msg.userId} joined this room`);
  });

  socket.on('add_message', function(msg) {
    console.log(`user ${msg.userId} said "${msg.message}"`);
    $('#messages').append(
      `<li>${msg.userId}: "${msg.message}"</li>`
    );
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
    currentRoom.text(roomId);
    return false;
  });

  $('form#send').submit(function() {
    const message = $('#m').val();
    socket.emit('add_message', {
      roomId: currentRoom.text(),
      message,
    });
    $('#messages').append(
      `<li>${socket.id}: "${message}"</li>`
    );
    $('#m').val('');
    return false;
  });

  $('#fc').submit(function() {
    socket.emit('find_counsellor', {});
    return false;
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

    currentRoom.text(data.roomId);
  });

  $('#jac').submit(function() {
    socket.emit('counsellor_online', {
      counsellorId: $('#cid').val(),
      counsellorName: $('#cname').val(),
    });
    isCounsellor = true;
    return false;
  });

  socket.on('counsellor_online', function(data) {
    $('#conline').text('Online as Counsellor');
  });
})(jQuery, io); // eslint-disable-line no-undef
