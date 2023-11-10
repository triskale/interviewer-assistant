const elements = {
  toggleSettings: document.getElementById("toggleSettings"),
  toggleRecording: document.getElementById("toggleRecording"),
  transcription: document.getElementById("transcription"),
  answer: document.getElementById("answer"),
  role: document.getElementById("role"),
  apiKey: document.getElementById("apiKey"),
  interviewType: document.getElementById("interviewType"),
  toggleRole: document.getElementById("toggleRole"),
  roleInput: document.getElementById("role"),
  interviewTypeInput: document.getElementById("interviewType"),
};

let recorder = null;
let isRecording = false;
let audioChunks = [];
let context = new AudioContext();

function initSettings() {
  elements.apiKey.value = localStorage.getItem("apiKey") || "";
  elements.role.value = localStorage.getItem("role") || "";
  elements.interviewType.value = localStorage.getItem("interviewType") || "";
  elements.transcription.textContent =
    localStorage.getItem("transcription") || "no question yet";
  elements.answer.innerHTML =
    localStorage.getItem("answer") || "no answers yet";
  elements.toggleRole.value =
    localStorage.getItem("toggleRole") || "interviewer";
}

// Event listeners for settings changes
function setupListeners() {
  elements.toggleSettings.addEventListener("click", function () {
    const settingsView = document.getElementById("settingsView");
    settingsView.style.display =
      settingsView.style.display === "none" ? "block" : "none";
  });
  elements.toggleRole.addEventListener("change", function (event) {
    localStorage.setItem("toggleRole", event.target.value);
  });
  elements.apiKey.addEventListener("change", function (event) {
    localStorage.setItem("apiKey", event.target.value);
  });
  elements.roleInput.addEventListener("change", function (event) {
    localStorage.setItem("role", event.target.value);
  });
  elements.interviewTypeInput.addEventListener("change", function (event) {
    localStorage.setItem("interviewType", event.target.value);
  });
  elements.toggleRecording.addEventListener("click", function () {
    if (isRecording) {
      stopRecording();
      elements.toggleRecording.textContent = "Record";
      elements.toggleRecording.classList.remove("stop");
    } else {
      startCapture()
        .then(() => {
          elements.toggleRecording.textContent = "Stop";
          elements.toggleRecording.classList.add("stop");
        })
        .catch((error) => {
          console.error("Error starting capture:", error);
        });
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  initSettings();
  setupListeners();
});

function showSpinner(type) {
  document.getElementById(type).style.display = "none";
  document.getElementById(`${type}-spinner`).style.display = "block";
}

function hideSpinner(type) {
  document.getElementById(type).style.display = "block";
  document.getElementById(`${type}-spinner`).style.display = "none";
}
