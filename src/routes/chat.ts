import Chat from '../models/chat';
import User from '../models/user';
import Message, {MMessage} from '../models/message';
import server from 'socket.io';
import events from 'events';
import _ from 'lodash';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import http from 'http';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const privateKey = fs.readFileSync(path.resolve(__dirname, '../private.pem'));

const socketIni = (http: http.Server) => {
  const eventEmitter = new events.EventEmitter();
  const io = server.listen(http);
  const userStack: Record<string, unknown> = {};
  const userSocket: Record<string, string> = {};
  const ioChat = io.of('/chat');
  let setRoom: (roomId: string) => void;
  const sendUserStack = (
    chatPersons: {username: string; _id: string}[],
    userPStack: Record<string, unknown>,
    username: string
  ) => {
    for (const i in userSocket) {
      for (const j in userStack) {
        if (j === i) {
          userStack[j] = 'Online';
        }
      }
    }
    for (const i of chatPersons) {
      for (const j in userStack) {
        if (j === i.username) {
          userPStack[j] = userStack[j];
        }
      }
    }
    ioChat.to(userSocket[username]).emit('onlinePStack', userPStack);
    ioChat.emit('onlineStack', userStack);
  };
  const oldChats = (
    result: MMessage[],
    username: string,
    room: string,
    msgCount: number
  ) => {
    ioChat.to(userSocket[username]).emit('oldChats', {
      messages: result,
      room: room,
      msgCount,
    });
  };
  const oldIniChats = (
    result: Record<string, unknown>,
    username: string,
    room: string,
    msgCount: number
  ) => {
    ioChat.to(userSocket[username]).emit('oldIniChats', {
      chat: result,
      room: room,
      msgCount,
    });
  };
  const newChats = (
    result: Record<string, unknown>,
    username: string,
    room: string,
    msgCount: number
  ) => {
    ioChat.to(userSocket[username]).emit('newChat', {
      chat: result,
      room: room,
      msgCount,
    });
  };
  // ioChat.on("hello",()=>{console.log("h1");});
  ioChat.on(
    'connection',
    (
      socket: server.Socket & {
        username: string;
        gRoom: string[];
        userPStack: Record<string, unknown>;
      }
    ) => {
      socket.userPStack = {};
      console.log('User connected');
      socket.on('setUserData', username => {
        console.log(username + ' logged in!');
        socket.username = username;
        userSocket[socket.username] = socket.id;
        eventEmitter.emit('getAllUsers', {
          username: username,
          userPStack: socket.userPStack,
        });
      });
      socket.on('re-renderStack', username => {
        eventEmitter.emit('getAllUsers', {
          username: username,
          userPStack: socket.userPStack,
        });
        // console.log("grbhhvj");
      });
      socket.on('getAllRoomId', data => {
        console.log('hello');

        eventEmitter.emit('sendRoomIds', {data, username: socket.username});
      });
      socket.on('setRoom', room => {
        //leaving room.
        // console.log(socket.gRoom);
        if (socket.gRoom != undefined) {
          for (const groom of socket.gRoom) {
            socket.leave(groom);
          }
        } else socket.gRoom = [];

        //getting room data.
        eventEmitter.emit('getRoomData', room);
        //setting room and join.
        setRoom = (roomId: string) => {
          socket.gRoom = socket.gRoom.concat(roomId);
          console.log('roomId : ' + roomId);
          socket.join(socket.gRoom);
          ioChat.to(userSocket[socket.username]).emit('setRoom', socket.gRoom);
        };
      });
      socket.on('updateMsg', data => {
        eventEmitter.emit('updateMsg', data);
      });
      // socket.on('oldChatsInit', data => {
      //   eventEmitter.emit('readChat', data);
      // });
      socket.on('oldChats', data => {
        eventEmitter.emit('readChat', data);
      });
      //showing msg on typing.
      socket.on('typing', roomId => {
        socket
          .to(roomId)
          .broadcast.emit('typing', socket.username + ' is typing...');
      });
      socket.on('readMsg', data => {
        eventEmitter.emit('markRead', data);
      });
      socket.on('revealIdentity', data => {
        eventEmitter.emit('revealIden', data);
      });
      socket.on('chatMsg', data => {
        //emits event to save chat to database.
        eventEmitter.emit('saveChat', {
          msgFrom: data.msgFrom,
          msgTo: data.msgTo,
          msg: data.msg,
          chatId: data.roomId,
        });
      });
      socket.on('disconnect', () => {
        console.log(socket.username + ' logged out');
        socket.leaveAll();
        console.log('chat disconnected.');
        _.unset(userSocket, socket.username);
        userStack[socket.username] = 'Offline';
        ioChat.emit('onlineStack', userStack);
      });
    }
  );

  eventEmitter.on('saveChat', async data => {
    try {
      // console.log("hello");

      const newMessage = new Message({
        from: data.msgFrom,
        to: data.msgTo,
        message: data.msg,
      });
      const message = await newMessage.save();
      const chat = await Chat.findById(data.chatId).exec();
      chat.messages.push(newMessage);
      await chat.save();
      ioChat.to(data.chatId).emit('chatMsg', {message, room: data.roomId});
    } catch (err) {
      ioChat.to(userSocket[data.msgFrom.username]).emit('error', err.message);
    }
  });

  eventEmitter.on('readChat', async data => {
    try {
      const result = await Chat.findById(data.chatId)
        .populate({
          path: 'messages',
          options: {
            limit: 20,
            skip: parseInt(data.msgCount),
            sort: '-createdOn',
          },
        })
        .lean()
        .exec();
      oldChats(
        result.messages,
        data.username,
        data.room,
        parseInt(data.msgCount) + 20
      );
    } catch (err) {
      ioChat.to(userSocket[data.username]).emit('error', err.message);
    }
  });

  eventEmitter.on('sendRoomIds', async data => {
    try {
      const chats = await Chat.find({
        $or: [{user1: data.data}, {user2: data.data}],
      })
        .select('_id')
        .exec();
      // ioChat.to(userSocket[socket.username]).emit('recChatData', chats);
      for (const chat of chats) {
        eventEmitter.emit('readIniChat', {
          chatId: chat._id,
          user: data.data,
          username: data.username,
          room: chat._id,
        });
      }
    } catch (err) {
      ioChat.to(userSocket[data.username]).emit('error', err.message);
    }
  });

  eventEmitter.on('readIniChat', async data => {
    try {
      const result = await Chat.findById(data.chatId)
        .populate({
          path: 'messages',
          match: {$and: [{to: data.user}, {unread: true}]},
          options: {
            sort: '-createdOn',
          },
        })
        .lean()
        .exec();
      oldIniChats(result, data.username, data.room, result.messages.length);
    } catch (err) {
      ioChat.to(userSocket[data.username]).emit('error', err.message);
    }
  });

  eventEmitter.on('getAllUsers', async data => {
    try {
      const user = await User.findOne({username: data.username}).exec();
      const users = await User.find({}).select('username').exec();
      for (let i = 0; i < users.length; i++) {
        userStack[users[i].username] = 'Offline';
      }
      // console.log(user);

      sendUserStack(user.chatPersons, data.userPStack, data.username);
    } catch (err) {
      ioChat.to(userSocket[data.username]).emit('error', err.message);
    }
  });

  eventEmitter.on('createNewChat', async data => {
    try {
      console.log('heool');

      const newMessage = new Message({
        from: data.from,
        to: data.to,
        message:
          'Welcome to the chat room. Here you can chat with the seller and can ask for more details about the item',
      });
      await newMessage.save();
      const newChat = new Chat({
        user1: data.from,
        user2: data.to,
        item: data.item,
        messages: [newMessage],
        user2Anonymous: data.anonymous,
      });
      const chat = await newChat.save();
      if (!data.anonymous) {
        const user = await User.findById(data.from._id).exec();
        user.chatPersons = [...new Set(user.chatPersons.concat(data.to))];
        await user.save();
        const accessToken = jwt.sign({user}, privateKey, {
          expiresIn: '10min',
          issuer: 'auth.devclub.in',
          algorithm: 'RS256',
        });
        // const refreshToken = jwt.sign({user}, privateKey);
        // res.status(200).send({accessToken, refreshToken});

        console.log(accessToken);
      }
      const userb = await User.findById(data.to._id).exec();
      userb.chatPersons = [...new Set(userb.chatPersons.concat(data.from))];
      await userb.save();
      const accessToken = jwt.sign({user:userb}, privateKey, {
        expiresIn: '10min',
        issuer: 'auth.devclub.in',
        algorithm: 'RS256',
      });
      // const refreshToken = jwt.sign({user}, privateKey);
      // res.status(200).send({accessToken, refreshToken});

      console.log(accessToken);
      const result = await Chat.findById(chat._id)
        .populate('messages')
        .lean()
        .exec();
      setRoom(chat._id);
      oldIniChats(result, data.from.username, chat._id, 1);
      if (userSocket[data.to.username]) {
        newChats(result, data.to.username, chat._id, 1);
      }
    } catch (err) {
      ioChat.to(userSocket[data.from.username]).emit('error', err.message);
    }
  });

  eventEmitter.on('revealIden', async data => {
    console.log(20);

    try {
      const user = await User.findById(data.from._id).exec();
      const newMessage = new Message({
        from: data.from,
        to: data.to,
        message: `${user}`,
      });
      await newMessage.save();
      const userb = await User.findById(data.to._id).exec();
      userb.chatPersons = [...new Set(userb.chatPersons.concat(data.from))];
      await userb.save();
      const accessToken = jwt.sign({user:userb}, privateKey, {
        expiresIn: '10min',
        issuer: 'auth.devclub.in',
        algorithm: 'RS256',
      });
      // const refreshToken = jwt.sign({user}, privateKey);
      // res.status(200).send({accessToken, refreshToken});

      console.log(accessToken);
      const chat = await Chat.findById(data.chatId).populate('messages').exec();
      chat.user2Anonymous = false;
      chat.messages.push(newMessage);
      await chat.save();
      ioChat
        .to(data.chatId)
        .emit('chatMsg', {message: newMessage, room: data.chatId});
      if (userSocket[data.to._id]) {
        ioChat.to(userSocket[data.to._id]).emit('re-renderStack', null);
      }
    } catch (err) {
      ioChat.to(userSocket[data.from.username]).emit('error', err.message);
    }
  });

  eventEmitter.on('getRoomData', data => {
    Chat.findOne({
      $and: [
        {$or: [{user1: data.from}, {user1: data.to}]},
        {$or: [{user2: data.from}, {user2: data.to}]},
        {item: data.item},
      ],
    })
      .populate({
        path: 'messages',
        options: {
          limit: 20,
          skip: parseInt(data.msgCount),
          sort: '-createdOn',
        },
      })
      .lean()
      .exec((err, result) => {
        if (err) {
          ioChat.to(userSocket[data.username]).emit('error', err.message);
        } else if (result === undefined || result === null) {
          eventEmitter.emit('createNewChat', data);
        } else {
          setRoom(result._id);
          oldChats(
            result.messages,
            data.username,
            result._id,
            parseInt(data.msgCount) + 20
          );
        }
      });
  });

  eventEmitter.on('markRead', async data => {
    try {
      const chat = await Chat.findById(data.chatId).populate({
        path: 'messages',
        match: {$and: [{to: data.user}, {unread: true}]},
      });
      for (const message of chat.messages) {
        message.unread = false;
        await message.save();
        if (userSocket[message.from.username]) {
          ioChat.to(userSocket[message.from.username]).emit('updateMsg', {
            room: data.chatId,
            messageId: message._id,
            message,
          });
        }
      }
    } catch (err) {
      ioChat.to(userSocket[data.user.username]).emit('error', err.message);
    }
  });

  eventEmitter.on('updateMsg', async data => {
    try {
      const chat = await Chat.findById(data.room)
        .populate({
          path: 'messages',
          match: {_id: data.message._id},
        })
        .exec();
      for (const message of chat.messages) {
        message.message = data.message.message;
        message.unread = true;
        await message.save();
        if (userSocket[message.from.username]) {
          ioChat.to(userSocket[message.from.username]).emit('updateMsg', {
            room: data.room,
            messageId: message._id,
            message,
          });
        }
        if (userSocket[message.to.username]) {
          ioChat.to(userSocket[message.to.username]).emit('updateMsg', {
            room: data.room,
            messageId: message._id,
            message,
          });
        }
      }
      await chat.save();
    } catch (err) {
      if (userSocket[data.message.from.username]) {
        ioChat
          .to(userSocket[data.message.from.username])
          .emit('error', err.message);
      }
      if (userSocket[data.message.to.username]) {
        ioChat
          .to(userSocket[data.message.to.username])
          .emit('error', err.message);
      }
    }
  });
  return io;
};

export default socketIni;
