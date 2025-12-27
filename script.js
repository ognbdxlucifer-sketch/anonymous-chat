// =====================
// AUTO BACKEND DETECTION
// =====================
const BACKEND_URL =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:3000"
    : "https://anonymous-chat-backend-4v20.onrender.com";

const socket = io(BACKEND_URL);

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
  if (sessionToken) socket.emit("auto_login", sessionToken);
});

// =====================
// AUTH
// =====================
window.register = function () {
  if (!regUsername.value || !regPassword.value) return alert("Fill all fields");
  socket.emit("register", {
    username: regUsername.value.trim(),
    password: regPassword.value.trim(),
  });
};

window.login = function () {
  if (!loginUsername.value || !loginPassword.value)
    return alert("Fill all fields");

  socket.emit("login", {
    username: loginUsername.value.trim(),
    password: loginPassword.value.trim(),
  });
};

window.logout = function () {
  socket.emit("logout", sessionToken);
  localStorage.removeItem("sessionToken");
};

// =====================
// AUTH RESPONSES
// =====================
socket.on("login_success", ({ username, token }) => {
  myUsername = username;
  sessionToken = token;
  localStorage.setItem("sessionToken", token);

  myIdSpan.innerText = username;
  authBox.style.display = "none";
  chatApp.style.display = "block";
});

socket.on("logout_success", () => location.reload());
socket.on("auth_error", (m) => alert(m));

// =====================
// USERS
// =====================
socket.on("online_users", (users) => {
  usersList.innerHTML = "";
  users.forEach((u) => {
    if (u.username !== myUsername) {
      const li = document.createElement("li");
      li.innerText = u.username;
      li.onclick = () => openPrivateChat(u.socketId, u.username);
      usersList.appendChild(li);
    }
  });
});

// =====================
// RECEIVE PUBLIC MESSAGE
// =====================
socket.on("public_message", (d) => {
  if (currentChat === "public" && d.from !== myUsername) {
    messages.innerHTML += `<div class="message other">${d.message}</div>`;
    messages.scrollTop = messages.scrollHeight;
  }
});

// =====================
// RECEIVE PRIVATE MESSAGE
// =====================
socket.on("private_message", (d) => {
  if (!privateChats[d.socketId]) {
    privateChats[d.socketId] = { username: d.from, messages: [], unread: 0 };
  }

  privateChats[d.socketId].messages.push({ from: d.from, text: d.message });

  if (activePrivateSocketId !== d.socketId) {
    privateChats[d.socketId].unread++;
    updatePrivateList();
    return;
  }

  messages.innerHTML += `<div class="message other">${d.message}</div>`;
  messages.scrollTop = messages.scrollHeight;
});

// =====================
// SEND MESSAGE
// =====================
window.sendMessage = function () {
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

  messages.innerHTML += `<div class="message you">${msgInput.value}</div>`;
  messages.scrollTop = messages.scrollHeight;
  msgInput.value = "";
};

// =====================
// PRIVATE CHAT
// =====================
function openPrivateChat(id, username) {
  currentChat = "private";
  activePrivateSocketId = id;
  chatTitle.innerText = "Chat with " + username;
  messages.innerHTML = "";
  privateChats[id].unread = 0;

  privateChats[id].messages.forEach((m) => {
    messages.innerHTML += `<div class="message ${
      m.from === "You" ? "you" : "other"
    }">${m.text}</div>`;
  });
  updatePrivateList();
}

window.backToPublic = function () {
  currentChat = "public";
  chatTitle.innerText = "Public Chat";
  messages.innerHTML = "";
};

function updatePrivateList() {
  privateList.innerHTML = "";
  Object.values(privateChats).forEach((c) => {
    const li = document.createElement("li");
    li.innerText = c.username + (c.unread ? ` (${c.unread})` : "");
    li.onclick = () => openPrivateChat(c.socketId, c.username);
    privateList.appendChild(li);
  });
}
