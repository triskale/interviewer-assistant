const key = "Bearer something something";
let recorder = null;
let isRecording = false;
let audioChunks = [];
let context = new AudioContext();

document.addEventListener("DOMContentLoaded", function () {
  const toggleBtn = document.getElementById("toggle-recording");

  const transcriptionElement = document.getElementById("transcription");
  const answerElement = document.getElementById("answer");
  const additionalPromptElement = document.getElementById("additional-prompt");

  // Restore state from localStorage
  transcriptionElement.textContent =
    localStorage.getItem("transcription") || "";
  answerElement.innerHTML = localStorage.getItem("answer") || "";
  additionalPromptElement.value =
    localStorage.getItem("additionalPrompt") || "";

  toggleBtn.addEventListener("click", function () {
    if (isRecording) {
      stopRecording();
      toggleBtn.textContent = "Record";
      toggleBtn.classList.remove("stop");
    } else {
      startCapture()
        .then(() => {
          toggleBtn.textContent = "Stop";
          toggleBtn.classList.add("stop");
        })
        .catch((error) => {
          console.error("Error starting capture:", error);
        });
    }
  });
});

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
      console.log("Recorder started");
      resolve();
    });
  });
}

function stopRecording() {
  if (recorder && isRecording) {
    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
    console.log("Recorder stopped");
    isRecording = false;
  }
}

function exportRecording() {
  const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
  const audioFile = new File([audioBlob], "recording.wav", {
    type: "audio/wav",
  });
  // Prepare the form data to send to Whisper API
  let formData = new FormData();
  formData.append("file", audioFile);
  formData.append("model", "whisper-1");
  showSpinner("transcription");
  fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: key,
    },
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      const transcription = data.text;
      hideSpinner("transcription");
      displayTranscription(transcription);
      askQuestion(transcription);
      localStorage.setItem("transcription", transcription);
    })
    .catch((error) => {
      console.error("Error transcribing audio:", error);
    });
}

function displayTranscription(transcription) {
  const transcriptionElement = document.getElementById("transcription");
  transcriptionElement.textContent = transcription;
  transcriptionElement.style.display = "block";
}

function askQuestion(transcription) {
  const additionalPrompt = document.getElementById("additional-prompt").value;

  const messages = [
    {
      role: "system",
      content:
        "You are an interview assistant. You help the interviewer know what to expect from their questions. You are assisting with finding the best Senior Software Engineering Manager. The user will present you with a dialog and you need to list in a very concise manner (as they need to read it while talking) the most important things to talk about to answer the question or scenario properly. You need to help them know what are the best answers to their questions. You respond in bullet points. Please make sure to not mention more than 4 bullet points. If needed add a bit of explanation next to the bullet point but keep it concise. You might get confusing context or questions, you are being given a transcript of an interview. You ALWAYS stick to answering in bullet points, without asking for more information and you don't introduce anything or conclude anything. If you really can't answer anything you reply ERROR. Please use html tags like <ul> to display the list. You use a maximum of 150 tokens.",
    },
  ];

  if (additionalPrompt) {
    messages.push({
      role: "system",
      content: `Additional information about the interview: ${additionalPrompt}`,
    });
  }

  messages.push({
    role: "user",
    content: `Transcript: ${transcription}`,
  });
  // Construct the request payload
  const payload = {
    model: "gpt-4-1106-preview",
    messages,
    temperature: 0.3,
    max_tokens: 170,
  };

  // Make the API call to GPT-4
  showSpinner("answer");
  fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: key,
    },
    body: JSON.stringify(payload),
  })
    .then((response) => response.json())
    .then((data) => {
      hideSpinner("answer");
      displayAnswer(data.choices[0].message.content);
      localStorage.setItem("answer", answer.innerHTML);
    })
    .catch((error) => {
      console.error("Error getting answer:", error);
    });
}

function displayAnswer(answer) {
  // Display the GPT-4 response in the popup
  const answerElement = document.getElementById("answer");
  answerElement.innerHTML = answer;
  answerElement.style.display = "block";
}

document
  .getElementById("additional-prompt")
  .addEventListener("change", function (event) {
    localStorage.setItem("additionalPrompt", event.target.value);
  });

function showSpinner(type) {
  document.getElementById(type).style.display = "none";
  document.getElementById(`${type}-spinner`).style.display = "block";
}

function hideSpinner(type) {
  document.getElementById(type).style.display = "block";
  document.getElementById(`${type}-spinner`).style.display = "none";
}
