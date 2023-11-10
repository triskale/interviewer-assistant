const elements = {
  toggleSettings: document.getElementById("toggleSettings"),
  toggleRecording: document.getElementById("toggleRecording"),
  transcription: document.getElementById("transcription"),
  answer: document.getElementById("answer"),
  role: document.getElementById("role"),
  apiKey: document.getElementById("apiKey"),
  interviewType: document.getElementById("interviewType"),
  roleToggle: document.getElementById("toggleRole"),
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
  elements.roleToggle.value =
    localStorage.getItem("toggleRole") || "interviewer";
}

// Event listeners for settings changes
function setupSettingsListeners() {
  elements.toggleSettings.addEventListener("click", function () {
    const settingsView = document.getElementById("settingsView");
    settingsView.style.display =
      settingsView.style.display === "none" ? "block" : "none";
  });
  elements.roleToggle.addEventListener("change", function (event) {
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
}

document.addEventListener("DOMContentLoaded", function () {
  initSettings();
  setupSettingsListeners();
  setupRecording();
});

function setupRecording() {
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

function startCapture() {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
if (chrome.runtime.lastError || !stream) {
        reject(chrome.runtime.lastError?.message);
        return;
      }
        context.createMediaStreamSource(stream).connect(context.destination);

        isRecording = true;
        audioChunks = [];
        recorder = new MediaRecorder(stream);

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        recorder.onstop = exportRecording;

        recorder.onerror = (event) => {
          console.error("Recorder Error: ", event.error);
          reject(event.error);
        };

        recorder.start();
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function stopRecording() {
  if (recorder && isRecording) {
    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
    isRecording = false;
  }
}

function exportRecording() {
  const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
  const audioFile = new File([audioBlob], "recording.wav", {
    type: "audio/wav",
  });
  let formData = new FormData();
  formData.append("file", audioFile);
  formData.append("model", "whisper-1");
  showSpinner("transcription");
  fetchTranscription(formData);
}


function showSpinner(type) {
  document.getElementById(type).style.display = "none";
  document.getElementById(`${type}-spinner`).style.display = "block";
}

function hideSpinner(type) {
  document.getElementById(type).style.display = "block";
  document.getElementById(`${type}-spinner`).style.display = "none";
}

function fetchTranscription(body) {
  fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${elements.apiKey.value}`,
    },
    body,
  })
    .then((response) => response.json())
    .then((data) => {
      const transcription = data.text;
      hideSpinner("transcription");
      elements.transcription.textContent = transcription;
      elements.transcription.style.display = "block";
      askQuestion(transcription);
      localStorage.setItem("transcription", transcription);
    })
    .catch((error) => {
      console.error("Error transcribing audio:", error);
    });
}

function fetchAnswer(body) {
  fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${elements.apiKey.value}`,
    },
    body,
  })
    .then((response) => response.json())
    .then((data) => {
      hideSpinner("answer");
      const { content } = data.choices[0].message
      elements.answer.innerHTML = content;
      elements.answer.style.display = "block";
      localStorage.setItem("answer", content);
    })
    .catch((error) => {
      console.error("Error getting answer:", error);
    });
}

function askQuestion(transcription) {
  const messages = [
    {
      role: "system",
      content: "You are a useful interview assistant.",
    },
  ];

  if (elements.toggleRole.value === "interviewer") {
    messages.push({
      role: "system",
      content:
        "You help the interviewer ask relevant questions to the interviewee. The user will present you with a dialog and you need to list the most important things to ask the interviewee to get to know if they are a good candidate. You need to help them know what are the best questions and what topics to cover.",
    });
  } else {
    messages.push({
      role: "system",
      content:
        "You help the interviewer know what to expect from their questions. The user will present you with a dialog and you need to list the most important things to talk about to answer the question or scenario properly. You need to help them know what are the best answers to their questions.",
    });
  }

  messages.push({
    role: "system",
    content:
      "You respond in bullet points in a very concise manner (as they need to read it while talking) in a very concise manner (as they need to read it while talking). Please make sure to not mention more than 4 bullet points. If needed add a bit of explanation next to the bullet point but keep it concise. You might get confusing context or questions, you are being given a transcript of an interview. You ALWAYS stick to answering in bullet points, without asking for more information and you don't introduce anything or conclude anything. If you really can't answer anything you reply ERROR. Please use html tags like <ul> to display the list. You use a maximum of 150 tokens.",
  });

  if (elements.role.value) {
    messages.push({
      role: "system",
      content: `You are assisting with finding the best ${elements.role?.value}.`,
    });
  }

  if (elements.interviewType.value) {
    messages.push({
      role: "system",
      content: `This dialog is from a ${elements.interviewType.value} interview`,
    });
  }

  messages.push({
    role: "user",
    content: `Interview Transcript: ${transcription}`,
  });

  const payload = {
    model: "gpt-4-1106-preview",
    messages,
    temperature: 0.3,
    max_tokens: 170,
  };

  showSpinner("answer");
  fetchAnswer(JSON.stringify(payload));
}
