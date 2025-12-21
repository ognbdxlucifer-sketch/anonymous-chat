// =====================
// AUTO BACKEND DETECTION (LOCAL + RENDER)
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
let currentChat = "public"; // public | private
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
window.register = function () {
  const username = regUsername.value.trim();
  const password = regPassword.value.trim();

  if (!username || !password) {
    alert("Enter username & password");
    return;
  }

  socket.emit("register", { username, password });
};

window.login = function () {
  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();

  if (!username || !password) {
    alert("Enter username & password");
    return;
  }

  socket.emit("login", { username, password });
};

window.logout = function () {
  socket.emit("logout", sessionToken);
  localStorage.removeItem("sessionToken");
};

// =====================
// AUTH RESPONSES
// =====================
socket.on("register_success", (msg) => {
  alert(msg);
});

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

socket.on("auth_error", (msg) => {
  alert(msg);
});

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
    messages.innerHTML +=
      "<p><b>" + d.from + ":</b> " + d.message + "</p>";
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
      socketId: socketId,
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

  messages.innerHTML +=
    "<p><b>" + d.from + ":</b> " + d.message + "</p>";
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

  messages.innerHTML +=
    "<p><b>You:</b> " + msgInput.value + "</p>";
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
      username: username,
      messages: [],
      unread: 0,
      socketId: socketId,
    };
  }

  privateChats[socketId].unread = 0;
  chatTitle.innerText = "Private Chat with " + username;
  messages.innerHTML = "";

  privateChats[socketId].messages.forEach((m) => {
    messages.innerHTML +=
      "<p><b>" + m.from + ":</b> " + m.text + "</p>";
  });

  updatePrivateList();
}

// =====================
// BACK TO PUBLIC CHAT (GLOBAL)
// =====================
window.backToPublic = function () {
  currentChat = "public";
  activePrivateSocketId = null;
  chatTitle.innerText = "Public Chat";
  messages.innerHTML = "";
};

// =====================
// PRIVATE CHAT LIST
// =====================
function updatePrivateList() {
  privateList.innerHTML = "";

  Object.values(privateChats).forEach((chat) => {
    const li = document.createElement("li");
    let text = chat.username;

    if (chat.unread > 0) {
      text += " (" + chat.unread + ")";
    }

    li.innerText = text;
    li.onclick = () =>
      openPrivateChat(chat.socketId, chat.username);

    privateList.appendChild(li);
  });
}
