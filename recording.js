function startCapture() {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
      if (chrome.runtime.lastError || !stream) {
        reject(chrome.runtime.lastError?.message);
        elements.transcription.textContent = "❌ No audio to capture, check Active Tab and open the Popup again ❌";
        elements.transcription.style.display = "block";
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

async function askQuestion(transcription) {
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
        "You help the interviewer ask relevant questions to the interviewee. The user will present you with a dialog and you need to list the most important things to ask the interviewee to get to know if they are a good candidate. You need to help the user know what are the best questions to ask and what topics to cover.",
    });
  } else {
    messages.push({
      role: "system",
      content:
        "You help the interviewer know what to expect from their questions. The user will present you with a dialog or scenario and you need to list the most important things to talk about to answer the question or scenario properly. You need to help the user know what are the best answers to their questions.",
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
  await fetchAnswer(JSON.stringify(payload));
}

async function fetchTranscription(body) {
  fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${elements.apiKey.value}`,
    },
    body,
  })
    .then((response) => response.json())
    .then(async (data) => {
      let transcription = data.text;
      hideSpinner("transcription");
      elements.transcription.textContent = transcription;
      elements.transcription.style.display = "block";
      await askQuestion(transcription);
      localStorage.setItem("transcription", transcription);
    })
    .catch((error) => {
      console.error("Error transcribing audio:", error);
    });
}

async function fetchAnswer(body) {
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
      let { content } = data.choices[0].message;
      if (content === "ERROR") {
        content = "❌ Not enough data to process! ❌";
      }
      elements.answer.innerHTML = content;
      elements.answer.style.display = "block";
      localStorage.setItem("answer", content);
    })
    .catch((error) => {
      console.error("Error getting answer:", error);
    });
}
