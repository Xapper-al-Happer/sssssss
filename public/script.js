var chatWindow = document.querySelector('ul.messages');
var chatList = document.querySelector('ul.rooms');
var chatAction = document.getElementById('action');

var socket = io({reconnectionAttempts:5});
addMessage(null, socket.id, null, {type:'join',room:'public'});

function getCookie(name) {
	var dc = document.cookie;
	var prefix = name + "=";
	var begin = dc.indexOf("; " + prefix);
	if (begin == -1) {
		begin = dc.indexOf(prefix);
		if (begin != 0) return null;
	}
	else
	{
		begin += 2;
		var end = document.cookie.indexOf(";", begin);
		if (end == -1) {
			end = dc.length;
		}
	}
	return decodeURI(dc.substring(begin + prefix.length, end));
}

if(getCookie('authed')) {
	document.querySelector('.modal:last-child').style.visibility = 'hidden';
	document.querySelector('form input').focus();
}

socket.on('connect', () => {
	if(document.getElementById('alert')) {
		document.getElementById('alert').remove();
	}
	document.querySelector('div.modal').style.display = 'flex';
	document.querySelector('div.modal form input').placeholder = socket.id;
	document.querySelector('div.modal form input').focus();
});

socket.on('update', data => {
	for(const[key,value] of Object.entries(data)) {
		socket[key] = value;
	}
})

document.querySelector('form input').oninput = function(e) {
	socket.emit('typing',true);
	if(this.value.startsWith('/')) {
		let commandList;
		fullyScrolled = chatWindow.scrollHeight - chatWindow.offsetHeight == chatWindow.scrollTop;
		if(!document.getElementById('commands')) {
			commandList = document.createElement('ul');
			commandList.style.background = '#292929';
			commandList.id = 'commands';
			this.parentElement.insertBefore(commandList, this);
		}
		else {
			commandList = document.getElementById('commands');
		}
		let commands = socket.commands;
		if((this.value.length - 1) == 0) {
			for(var key in commands) {
				if(!document.getElementById(key)) {
					let command = document.createElement('li');
					command.id = key;
					let args = [];
					if(commands[key].args) {
						commands[key].args.forEach((argument, index) => {args[index]=' <tag'+(argument.type==null?'':'')+'>'+argument.name+'</tag>'});
					}
					command.innerHTML = '<e style="font-size:12px;vertical-align:middle;"><ion-icon name="' + (commands[key].icon ? commands[key].icon : 'caret-forward-circle') + '" role="img" class="md hydrated"></ion-icon></e>&nbsp;<b style="color:white;">/' + key + (args[0]?args.join(''):'') + '</b>&nbsp;' + commands[key].desc + '<small style = "margin-left:auto;">' + (!commands[key].from?'Built-in':commands[key].from) +'</small>';
					command.style.cursor = 'pointer';
					command.setAttribute('onClick','document.querySelector("form input").value = "/" + this.id;let e=document.createEvent("HTMLEvents");e.initEvent("input",true,true);document.querySelector("form input").dispatchEvent(e);document.querySelector("form input").focus();');
					commandList.appendChild(command);
				}
			}
		}
		else {
			let escapedCommands = [];
			for (var i = 0; i < this.value.substr(1).length; i++) {
				for(var key in commands) {
					if(this.value.substr(1).length > key.length && this.value.charAt(key.length + 1) == ' ') {
						void(0);
					} 
					else {
					  if(key.charAt(i) != this.value.substr(1).charAt(i) || escapedCommands.includes(key)) {
							if(document.getElementById(key)) {
								document.getElementById(key).remove();
							}
							escapedCommands.push(key);
						}
						else {
							if(!document.getElementById(key)) {
								let command = document.createElement('li');
								command.id = key;
								let args = [];
								if(commands[key].args) {
									commands[key].args.forEach((argument, index) => {args[index]=' <tag'+(argument.type==null?'':'')+'>'+argument.name+'</tag>'});
								}
								command.innerHTML = '<e style="font-size:12px;vertical-align:middle;"><ion-icon name="' + (commands[key].icon ? commands[key].icon : 'caret-forward-circle') + '" role="img" class="md hydrated"></ion-icon></e>&nbsp;<b style="color:white;">/' + key + (args[0]?args.join(''):'') + '</b>&nbsp;' + commands[key].desc + '<small style = "margin-left:auto;">' + (!commands[key].from?'Built-in':commands[key].from) +'</small>';
								command.style.cursor = 'pointer';
								command.setAttribute('onClick','document.querySelector("form input").value = "/" + this.id;let e=document.createEvent("HTMLEvents");e.initEvent("input",true,true);document.querySelector("form input").dispatchEvent(e);document.querySelector("form input").focus();');
								commandList.appendChild(command);
							}
						}
					}
				}
			}
		}
	}
	else if(document.getElementById('commands')) {
		document.getElementById('commands').remove();
	}
	if(fullyScrolled) {
    chatWindow.scrollTo(0, chatWindow.scrollHeight);
  }
}

document.querySelector('form').onsubmit = function(e) {
	e.preventDefault();
	if(this.querySelector('input').value) {
		addMessage(null,socket.id, this.querySelector('input').value.substr(0,2000), null, (chatAction.style.display=='block'?chatAction.id:null));
		socket.emit('message',{content:this.querySelector('input').value,replyTo:(chatAction.style.display=='block'?chatAction.id:null)});
		this.querySelector('input').value = '';
		chatAction.style.display = 'none';
		if(document.getElementById('commands')){
			document.getElementById('commands').remove();
		}
	}
}

function htmlspecialchars(s)
{
  var el = document.createElement("div");
  el.innerText = el.textContent = s;
  s = el.innerHTML;
  return s;
}

function addMessage(id, author, message, type, replyTo, badge) {
	var newMessage = document.createElement('li');
	newMessage.id = id;
	if(author == socket.id) {
		newMessage.setAttribute('pending', true);
		if(replyTo) {
			document.querySelector("ul.messages li[selected]").removeAttribute("selected");
		}
	}
	if(message && message.includes('@' + socket.id) || replyTo && document.getElementById(replyTo).querySelector('[name=author]').innerText == socket.id) {
		newMessage.classList.add('ping');
	}
	if(replyTo) {
		newMessage.innerHTML = '<small style="display: block;font-size:12px;margin-bottom: 2px;cursor:pointer;" onClick = "event.stopPropagation();document.getElementById(' + replyTo + ').scrollIntoView();"><e style = "font-size:12px;vertical-align:middle;"><ion-icon name="arrow-redo" style = "transform: scaleX(-1) rotate(90deg);"></ion-icon></e>&nbsp;<b>' + document.getElementById(replyTo).querySelector('[name=author]').innerHTML + '</b>&nbsp;' + (document.getElementById(replyTo).querySelector('span').innerHTML.length > 60?document.getElementById(replyTo).querySelector('span').innerHTML.substring(0, 60) + '...' : document.getElementById(replyTo).querySelector('span').innerHTML) + '</small>';
	}
	newMessage.innerHTML = newMessage.innerHTML + (badge?'<e style="font-size:12px;vertical-align:middle;margin-right:10px;"><ion-icon name="' + badge + '" style="/* margin-right: 5px; *//* transform: scaleX(-1) rotate(90deg); */" role="img" class="md hydrated" aria-label="arrow redo"></ion-icon></e>':'') + '<b name = "author">' + htmlspecialchars(author) + '</b>&nbsp;<span>' + (!type?htmlspecialchars(message):'<b>'+(type.type=='disconnect'?'was temporarily disconnected from':(type.type=='join'?'joined':'left')) + ' <span>' + type.room + '</span></b>') + '</span><div class = "toolbar"><e style="font-size:12px;vertical-align:middle;" onClick = \'if(document.querySelector("ul.messages li[selected]")){document.querySelector("ul.messages li[selected]").removeAttribute("selected");}fullyScrolled = chatWindow.scrollHeight - chatWindow.offsetHeight == chatWindow.scrollTop;chatAction.querySelector("b").innerText=this.parentElement.parentElement.querySelector("[name=author]").innerText;if(chatAction.style.display=="none"||chatAction.id!=this.parentElement.parentElement.id){this.parentElement.parentElement.setAttribute("selected",true);chatAction.style.display="block";document.querySelector("form input").focus();}else{chatAction.style.display="none";}chatAction.id = this.parentElement.parentElement.querySelector("b").innerText;chatAction.id=this.parentElement.parentElement.id;if(fullyScrolled) {chatWindow.scrollTo(0, chatWindow.scrollHeight);}\'><ion-icon name="arrow-redo" role="img" class="md hydrated" aria-label="arrow redo"></ion-icon></e>' + (author == socket.id || (socket.teams ? socket.teams : []).includes('simplechat-mods') ? '<e style="font-size:12px;vertical-align:middle;color:indianred;" onClick = \'socket.emit("delete",this.parentElement.parentElement.id);\'><ion-icon name="trash" role="img" class="md hydrated" aria-label="arrow redo"></ion-icon></e>' : '') + '</div>';
	fullyScrolled = chatWindow.scrollHeight - chatWindow.offsetHeight == chatWindow.scrollTop;	
	chatWindow.append(newMessage);
  if(fullyScrolled) {
    chatWindow.scrollTo(0, chatWindow.scrollHeight);
  }
}

socket.on('delete', messageid => {
	let message = document.getElementById(messageid);
	if(message) {
		message.remove();
	}
})

socket.on('message', message => {
	if(message.author.id != socket.id) {
		addMessage(message.id, message.author, message.content, message.event, message.replyTo, message.badge);
	}
	else {
		chatWindow.querySelector('li[pending]').id = message.id;
			document.getElementById(message.id).removeAttribute('pending');
			document.getElementById(message.id).querySelector('[name=author]').innerText = (message.author.name?message.author.name:message.author.id);
		if(message.event && message.event.room) {
			document.getElementById(message.id).querySelector('span:last-child').innerText = message.event.room;
		}
		if(message.badge) {
			let e = document.createElement('e');
			e.style.fontSize = '12px';
			e.style.verticalAlign = 'middle';
			e.style.marginRight = '10px';
			e.innerHTML = '<ion-icon name="' + message.badge + '" style="/* margin-right: 5px; *//* transform: scaleX(-1) rotate(90deg); */" role="img" class="md hydrated" aria-label="arrow redo"></ion-icon>';

			document.getElementById(message.id).insertBefore(e,document.getElementById(message.id).querySelector('[name=author]'))
		}
	}
});

socket.on('disconnect', () => {
	addMessage(null, socket.id, '', {type:'disconnect'});
});

socket.on('connect_error', function() {
	if(!document.getElementById('alert')) {
		let newAlert = document.createElement('ul');
		newAlert.id = 'alert';
		newAlert.style.background = 'indianred';
		newAlert.style.fontSize = '12px';
		newAlert.style.display = 'block';
		newAlert.innerHTML = '<li><e style="font-size:12px;vertical-align:middle;"><ion-icon name="alert-circle" role="img" class="md hydrated" aria-label="arrow redo"></ion-icon></e> You\'ve been disconnected. <a>Reconnecting...</a></li>';
		document.querySelector('form').prepend(newAlert);
	}
});

socket.on('connect_failed', function() {
	document.getElementById('alert').querySelector('li a').setAttribute('onClick','socket.connect({reconnectionAttempts:5});');
	document.getElementById('alert').querySelector('li a').style.color = 'white';
	document.getElementById('alert').querySelector('li a').style.fontWeight = 900;
	document.getElementById('alert').querySelector('li a').innerHTML = 'Reconnect';
});

socket.on('typing', (members) => {
	delete members[socket.id];
	if(Object.keys(members).length > 0) {
		document.getElementById('indicator').style.visibility = 'visible';
		document.getElementById('indicator').querySelector('b').innerText = Object.values(members).join(', ');
	}
	else {
		document.getElementById('indicator').style.visibility = 'hidden';
	}
});

socket.on('room', (roomid) => {
	chatWindow.innerHTML = '';
	addMessage(null, socket.id, null, {type:'join'});
});