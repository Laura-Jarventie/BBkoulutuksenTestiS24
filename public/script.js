let currentQuestion = '';
let correctAnswer = '';


document.getElementById('send-button').addEventListener('click', sendMessage)
document.getElementById('send-image-button').addEventListener('click', sendImages);

document.getElementById('user-input').addEventListener('keypress', 
    function (e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    }
)


function sendImages(){
  
  const imageInput = document.getElementById('image-input');
  const files = imageInput.files;

  if (files.length === 0) {
    alert('Valitse kuvia ensin.');
    return;
  }

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('images', files[i]);
  }
  
  fetch('/upload', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      addMessageToChatbox('Error: ' + data.error, 'bot-message');
    } else {
      //jätetään toistaiseksi tyhjäksi. päivitetään sitten kun server-puoli on tehty.
     currentQuestion = data.question;
     correctAnswer = data.answer;
     addMessageToChatbox('OmaOpe: ' + data.question, 'bot-message');
    
    }
  })
  .catch(error => {
    console.error('Error:', error);
    addMessageToChatbox('OmaOpe: Jotain meni pieleen. Yritä uudelleen myöhemmin.', 'bot-message');
  });
  
}

/* TÄSSÄ ALKUPERÄINEN KUN OLI VIELÄ CHATGPT
function sendMessage(){
    const userInput = document.getElementById('user-input').value;
    console.log(userInput);

    document.getElementById('user-input').value = '';

    addMessageToChatbox ('Sinä:' + userInput, 'user-message' )

    fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: userInput })
      })
      .then(response => response.json())
      .then(data => {
        addMessageToChatbox('ChatGPT: ' + data.reply, 'bot-message');
      })
    
      .catch(error => {
        console.error('Error:', error);
        addMessageToChatbox('ChatGPT: Jotain meni pieleen. Yritä uudelleen myöhemmin.', 'bot-message');
      }); 
} */

function sendMessage(){
  const userInput = document.getElementById('user-input').value;
  console.log(userInput);

  document.getElementById('user-input').value = '';

  addMessageToChatbox ('Sinä:' + userInput, 'user-message' )

  fetch('/check-answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_answer: userInput, correct_answer:correctAnswer })
    })
    .then(response => response.json())
    .then(data => {
      const evaluation = data.evaluation;
      addMessageToChatbox(`OmaOpe: ${evaluation}`, 'bot-message');
      fetchNextQuestion(userInput);
    })
  
    .catch(error => {
      console.error('Error:', error);
      addMessageToChatbox(`OmaOpe: ${evaluation}`, 'bot-message');
    }); 
}

function fetchNextQuestion(userResponse) {
  fetch('/next-question', {
    method: 'POST',
headers: {
          'Content-Type': 'application/json'
      },

    body: JSON.stringify({ user_response: userResponse })

  })
 .then(response => response.json())
  .then(data => {
    if (data.error) {
      addMessageToChatbox('Error: ' + data.error, 'bot-message');
    } else {
      currentQuestion = data.question;
      correctAnswer = data.answer;
      addMessageToChatbox('OmaOpe: ' + data.question, 'bot-message');
    }
  })
  .catch(error => {
    console.error('Error:', error);
    addMessageToChatbox('OmaOpe: Jotain meni pieleen. Yritä uudelleen myöhemmin.', 'bot-message');
  });
}

function addMessageToChatbox(message, className) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', className);
    messageElement.textContent = message;
    document.getElementById('chatbox').appendChild(messageElement);
    document.getElementById('chatbox').scrollTop = document.getElementById('chatbox').scrollHeight;

}
