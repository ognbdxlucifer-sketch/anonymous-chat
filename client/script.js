// 🔥 CHANGE THIS TO YOUR RENDER URL
const socket = io("https://YOUR_RENDER_URL");

// =====================
// DOM
// =====================
const authBox = document.getElementById("authBox");
const chatApp = document.getElementById("chatApp");
const myIdSpan = document.getElementById("myId");

const regUsername = document.getElementById("regUsername");
const regPassword = document.getElementById("regPassword");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");

const usersList = document.getElementById("usersList");
const privateList = document.getElementById("privateList");
const messages = document.getElementById("messages");
const msgInput = document.getElementById("msg");
const chatTitle = document.getElementById("chatTitle");

// =====================
// STATE
// =====================
let myUsername = "";
let sessionToken = localStorage.getItem("sessionToken");
let currentChat = "public";
let activePrivateSocketId = null;
let privateChats = {};

// =====================
// AUTO LOGIN
// =====================
socket.on("connect", () => {
  if (sessionToken) {
    socket.emit("auto_login", sessionToken);
  }
});

// =====================
// AUTH
// =====================
window.register = () => {
  const username = regUsername.value.trim();
  const password = regPassword.value.trim();
  if (!username || !password) return alert("Enter username & password");
  socket.emit("register", { username, password });
};

window.login = () => {
  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();
  if (!username || !password) return alert("Enter username & password");
  socket.emit("login", { username, password });
};

window.logout = () => {
  socket.emit("logout", sessionToken);
  localStorage.removeItem("sessionToken");
};

// =====================
// AUTH RESPONSES
// =====================
socket.on("register_success", alert);

socket.on("login_success", ({ username, token }) => {
  myUsername = username;
  sessionToken = token;
  localStorage.setItem("sessionToken", token);

  myIdSpan.innerText = username;
  authBox.style.display = "none";
  chatApp.style.display = "block";
});

socket.on("logout_success", () => {
  myUsername = "";
  sessionToken = null;
  currentChat = "public";
  activePrivateSocketId = null;
  privateChats = {};

  messages.innerHTML = "";
  usersList.innerHTML = "";
  privateList.innerHTML = "";
  chatTitle.innerText = "Public Chat";

  chatApp.style.display = "none";
  authBox.style.display = "block";
});

socket.on("auth_error", alert);

// =====================
// ONLINE USERS
// =====================
socket.on("online_users", (users) => {
  usersList.innerHTML = "";
  users.forEach((u) => {
    if (!u.username || u.username === myUsername) return;
    const li = document.createElement("li");
    li.innerText = u.username;
    li.onclick = () => openPrivateChat(u.socketId, u.username);
    usersList.appendChild(li);
  });
});

// =====================
// PUBLIC CHAT
// =====================
socket.on("public_message", (d) => {
  if (currentChat === "public" && d.from !== myUsername) {
    messages.innerHTML += `<p><b>${d.from}:</b> ${d.message}</p>`;
  }
});

// =====================
// PRIVATE CHAT RECEIVE
// =====================
socket.on("private_message", (d) => {
  const socketId = d.socketId;

  if (!privateChats[socketId]) {
    privateChats[socketId] = {
      username: d.from,
      messages: [],
      unread: 0,
      socketId,
    };
  }

  privateChats[socketId].messages.push({
    from: d.from,
    text: d.message,
  });

  if (currentChat !== "private" || activePrivateSocketId !== socketId) {
    privateChats[socketId].unread++;
    updatePrivateList();
    return;
  }

  messages.innerHTML += `<p><b>${d.from}:</b> ${d.message}</p>`;
};

// =====================
// SEND MESSAGE
// =====================
window.sendMessage = () => {
  if (!msgInput.value) return;

  if (currentChat === "public") {
    socket.emit("public_message", msgInput.value);
  } else {
    socket.emit("private_message", {
      toSocketId: activePrivateSocketId,
      message: msgInput.value,
    });

    privateChats[activePrivateSocketId].messages.push({
      from: "You",
      text: msgInput.value,
    });
  }

  messages.innerHTML += `<p><b>You:</b> ${msgInput.value}</p>`;
  msgInput.value = "";
};

// =====================
// OPEN PRIVATE CHAT
// =====================
function openPrivateChat(socketId, username) {
  currentChat = "private";
  activePrivateSocketId = socketId;

  if (!privateChats[socketId]) {
    privateChats[socketId] = {
      username,
      messages: [],
      unread: 0,
      socketId,
    };
  }

  privateChats[socketId].unread = 0;
  chatTitle.innerText = `Private Chat with ${username}`;
  messages.innerHTML = "";

  privateChats[socketId].messages.forEach((m) => {
    messages.innerHTML += `<p><b>${m.from}:</b> ${m.text}</p>`;
  });

  updatePrivateList();
}

// =====================
// PRIVATE CHAT LIST
// =====================
function updatePrivateList() {
  privateList.innerHTML = "";
  Object.values(privateChats).forEach((chat) => {
    const li = document.createElement("li");
    li.innerText =
      chat.username + (chat.unread > 0 ? ` (${chat.unread})` : "");
    li.onclick = () => openPrivateChat(chat.socketId, chat.username);
    privateList.appendChild(li);
  });
}
