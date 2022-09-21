const express = require('express');
const fs = require('fs');
const Client = require("@replit/database");
const database = new Client();

const app = express();
const path = require('path');
const port = process.env.PORT || 8080;

const server = require('http').createServer(app);
const io = require('socket.io')(server,{cors:{origin:'*'}});

app.use(express.static(__dirname + '/public'));

const cors = require('cors');
app.all('/', cors(), (req, res, next) => next())

function getUser(id, token = null) {
	try {
		let user = io.sockets.sockets.get(id);
		return (user.token == token ? {nickname:user.nickname,badge:user.badge,room:user.room,preferences:user.preferences,commands:user.commands} : {nickname:user.nickname,badge:user.badge,room:user.room});
	}
	catch {
		return false;
	}
}

app.get('/api/:type?/:id?/:token?', (req, res) => {
	let response = Object();
	
	if(req.params.type == 'users') {
		let e = getUser(req.params.id, req.params.token);
		if(e) {
			response = e;
		}
		else {
			response.message = "Couldn't find that user";
		}
	}
	else if(req.params.type == 'rooms') {
		let room = rooms[req.params.id];
		if(room) {
			room.online = [];
			Array.from(io.sockets.adapter.rooms.get(req.params.id)).forEach((socket) => {
				room.online.push(socket);
			});
			response = room;
		}
		else {
			response.message = "Couldn't find that room";
		}
	}
	else {
		response.message = "Try specifying a root type, e.g. users, rooms";
	}

	res.json(response);
});

app.get('*', (req, res, next) => {
  var e = req.path;
  if(e == "/" || !fs.existsSync(__dirname + '/public' + e)) {
    // e = '/404.html';
    res.render("index", {type:"viewer", path:e});
  }
  res.sendFile(path.join(__dirname + '/public' + e));
});

var rooms = {};
rooms['public'] = {};
rooms['public'].typers = {};
rooms['public'].preferences = {authenticated:false};
rooms['public'].members = {owner:{name:process.env.REPL_OWNER,identifier:'construct'},mods:[]};

class Command {
	constructor(desc,icon,args=null) {
		this.desc = desc;
		this.icon = icon;
		this.args = args;
	}
}

io.commands = {
	"nick": {
		desc:"Nickname yourself",
		icon:"pencil",
		args: [
			{
				name:"nickname",
				type:String
			}
		]
	},
	"list": {
		desc:"List members or rooms",
		icon:"list",
		args: [
			{
				name:"type",
				type:null
			}
		]
	},
	"pref": {
		desc:"Change your preferences",
		icon:"cog",
		args: [
			{
				name:"preference",
				type:null
			},
			{
				name:"value",
				type:Boolean
			}
		]
	},
	"room": {
		desc:"Edit the room",
		icon:"browsers",
		args: [
			{
				name:"setting",
				type:String
			},
			{
				name:"key",
				type:String
			},
			{
				name:"value",
				type:null
			}
		]
	}
};

io.on('connection', (socket) => {
	require('crypto').randomBytes(48, function(err, buffer) {
	  socket.token = buffer.toString('hex');
		socket.emit('update',{'token':socket.token});
	});
	socket.commands = io.commands;
	socket.emit('update',{'commands':socket.commands})
	if(socket.handshake.headers['x-replit-user-name']) {
		socket.nickname = socket.handshake.headers['x-replit-user-name'];
		socket.emit('update',{'teams':socket.handshake.headers['x-replit-user-teams'].split(',')});
		if(socket.nickname == 'amasad') {
			socket.badge = 'star';
		}
		else if(socket.nickname == process.env.REPL_OWNER) {
			socket.badge = 'construct';
		}
		else {
			socket.badge = 'checkmark-circle';
		}
	}
	else {
		socket.nickname = socket.handshake.query.name;
	}

	socket.messages = [];
	
	socket.room = 'public';
	socket.join(socket.room);
	socket.emit('update',{room:socket.room});
	
	socket.preferences = {showTyping:true};
	var id = (new Date).getTime();
	
	socket.emit('message',{id:id,author:{id:socket.id,name:socket.nickname,badge:socket.badge},event:{type:'join',room:socket.room},badge:socket.badge});
	socket.to(socket.room).emit('message',{id:id,author:(socket.nickname?socket.nickname:socket.id),event:{type:'join',room:socket.room},badge:socket.badge});

	socket.messages.push(id);

	console.log(socket.nickname + '(' + socket.id + ')');
	
	socket.on('typing', (typing) => {
		if(!rooms[socket.room].typers[socket.id] && socket.preferences.showTyping) {
			rooms[socket.room].typers[socket.id] = (socket.nickname?socket.nickname:socket.id);
			io.to(socket.room).emit('typing', rooms[socket.room].typers);
			setTimeout(function(e){
				delete rooms[socket.room].typers[socket.id];
				io.to(socket.room).emit('typing', rooms[socket.room].typers);
			}, 3000);
		}
	});
	socket.on('addCommands', (commands) => {
		for(const[key,value] of Object.entries(commands)) {
			socket.commands[key] = new Command(...Object.values(value));
			socket.commands[key].from = socket.nickname;
		}
		socket.emit('update',{'commands':socket.commands});
	});
	socket.on('delete', (messageid) => {
		var mod = false;
		rooms[socket.room].members.mods.forEach((user,index) => {
			if(socket.nickname == user.name && socket.identifier == socket.badge || socket.id == user.identifier) {
				mod = true;
			}
		});
		if(socket.messages.includes(Number.parseInt(messageid)) || mod || socket.badge == 'construct') {
			io.to(socket.room).emit('delete', messageid);
		}
	});
	function joinRoom(roomid) {
		socket.to(socket.room).emit('message',{id:(new Date).getTime(),author:(socket.nickname?socket.nickname:socket.id),event:{type:'leave',room:socket.room},badge:socket.badge});
		socket.room = roomid;
		Array.from(socket.rooms.keys()).forEach(roomid => {
			if(socket.id != roomid) {
				socket.leave(roomid);
			}
		});
		socket.join(socket.room);
		if(!rooms[socket.room]) {
			rooms[socket.room] = {};
			socket.messages = [];
			rooms[socket.room].typers = {};
			rooms[socket.room].preferences = {authenticated:false};
			rooms[socket.room].members = {owner:{name:socket.nickname,identifier:(socket.badge?socket.badge:socket.id)},mods:[]};
		}
		socket.emit('room',socket.room);
		socket.emit('message',{id:id,author:{id:socket.id,name:socket.nickname,badge:socket.badge},event:{type:'join',room:socket.room},badge:socket.badge});
		socket.to(socket.room).emit('message',{id:id,author:(socket.nickname?socket.nickname:socket.id),event:{type:'join',room:socket.room},badge:socket.badge});
	}
	socket.on('message', (message) => {
		delete rooms[socket.room].typers[socket.id];
		message.content = message.content.substring(0,2000);
		io.to(socket.room).emit('typing', rooms[socket.room].typers);
		message.id = (new Date).getTime();
		socket.emit('message', {id:message.id,author:{id:socket.id,name:socket.nickname},content:message.content,replyTo:message.replyTo,badge:socket.badge});
		socket.to(socket.room).emit('message', {id:message.id,author:(socket.nickname?socket.nickname:socket.id),content:message.content,replyTo:message.replyTo,badge:socket.badge});
		socket.messages.push(message.id);
		if(message.content.startsWith('/')) {
			let arguments = message.content.substring(1).split(' ');
			let response = "I couldn't recognize what you said, but here are the arguments: " + arguments.join(', ');
			
			if(arguments[0] == 'nick') {
				if(!socket.badge) {
					arguments.shift();
					socket.nickname = arguments.join(' ').substring(0,32);
					if(socket.nickname) {
						response = 'You set your nickname to ' + socket.nickname;
					}
					else {
						response = 'You cleared your nickname';
					}
				}
				else {
					response = 'This command isn\'t available for authenticated users.';
				}
			}
			else if(arguments[0] == 'list') {
				if(arguments[1] == 'rooms') {
					response = Object.keys(rooms);
					response = 'There are ' + response.length + ' rooms available: ' + response.join(', ');
				}
				else {
					response = [];
					Array.from(io.sockets.adapter.rooms.get(socket.room)).forEach((socket) => {
						response.push(io.sockets.sockets.get(socket).nickname ? io.sockets.sockets.get(socket).nickname : socket);
					});
					response = 'There are ' + response.length + ' people online: ' + response.join(', ');
				}
			}
			else if(arguments[0] == 'pref') {
				if(typeof socket.preferences[arguments[1]] !== 'undefined') {
					if(arguments[2]) {
						socket.preferences[arguments[1]] = arguments[2] == 'true' ? true : false;
						response = 'Set ' + arguments[1] + ' to ' + socket.preferences[arguments[1]];
					}
					else {
						response = arguments[1] + ' is currently set to: ' + socket.preferences[arguments[1]];
					}
				}
				else {
					response = 'Here\'s a list of preferences: ' + Object.keys(socket.preferences).join(', ');
				}
			}
			else if(arguments[0] == 'room') {
				let room = rooms[socket.room];
				if(['destroy','name','promote','demote','pref'].includes(arguments[1])) {
					if(room.members.owner.name == socket.nickname || room.members.owner.identifier == socket.id || room.members.owner.identifier == socket.badge && room.members.owner.name == socket.nickname) {
						if(arguments[1] == 'destroy') {
							delete rooms[socket.room];
							joinRoom('public');
							response = 'Destroyed the room';
						}
						else if(arguments[1] == 'name') {
							rooms[arguments[2]] = room;
							delete rooms[socket.room];
							joinRoom(arguments[2]);
							response = 'Renamed the room to ' + arguments[1];
						}
						else if(arguments[1] == 'promote') {
							arguments.splice(0,2);
							var identifier;
							for(let[key,value] of io.sockets.sockets.entries()) {
								if(value.nickname == arguments.join(' ') || key == arguments.join(' ')) {
									if(value.badge) {
										identifier = value.badge;
									}
									else {
										identifier = key;
									}
								}
							}
							rooms[socket.room].members.mods.push({name:arguments.join(' '),identifier:identifier});
							response = 'OK, new mod: ' + arguments.join(' ');
						}
						else if(arguments[1] == 'demote') {
							arguments.splice(0,2);
							var success = false;
							room.members.mods.forEach((user,index) => {
								if(user.name == arguments.join(' ') || user.identifier == arguments.join(' ')) {
									rooms[socket.room].members.mods.splice(index,1);
									success = true;
								}
							});
							if(success == true) {
								response = "OK, removed " + arguments.join(' ') + " from the mod team.";
							}
							else {
								response = "Couldn't remove " + arguments.join(' ') + " from the mod team.";
							}
						}
						else {
							response = "You've captured an ultra-rare bug. Rest assured, I'm working on it.";
						}
					}
					else {
						response = "Only the owner of this room can use these commands!";
					}
				}
				else {
					if(arguments[1] == 'join') {
						joinRoom(arguments[2]);
						response = "You've been moved to " + socket.room;
					}
					else if(arguments[1] == 'help') {
						response = "Subcommands for regular user: join." + (room.members.owner.name == socket.nickname || room.members.owner.identifier == socket.id || room.members.owner.identifier == socket.badge && room.members.owner.name == socket.nickname ? " Subcommands for owner: destroy, name, promote, demote, pref" : "");
					}
					else if(arguments[1] == 'members') {
						response = JSON.stringify(room.members);
					}
					else {
						response = "You're in room: " + socket.room + ". Owner: " + room.members.owner.name;
					}
				}
			}
			
			io.to(socket.room).emit('message',{id:(new Date).getTime(),author:'Server',content:response,replyTo:message.id,badge:'shield'});
		}
	});
	socket.on('disconnect', (reason) => {
		socket.to(socket.room).emit('message',{id:(new Date).getTime(),author:(socket.nickname?socket.nickname:socket.id),event:{type:'leave',room:socket.room},badge:socket.badge});
	});
})

server.listen(app.get('port'));