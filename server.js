import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import multer from 'multer';
import vision from '@google-cloud/vision';
import fs from 'fs';

dotenv.config();

const upload = multer({ dest: 'uploads/' });

const app = express();
app.use(express.static('public'));
const port = 3000;


app.use(bodyParser.json());
app.use(express.static('public'));

const client = new vision.ImageAnnotatorClient({
  keyFilename: 'omaope-vision.json' 
});

let combinedText = '';
let context = [];
let currentQuestion = ''; //Muuttuja kysymyksen tallentamiseen
let correctAnswer = ''; // Muuttuja oikean vastauksen tallentamiseen

app.post('/upload', upload.array('images', 10), async (req, res) => {
  console.log('Received images upload');
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  try {
    const texts = await Promise.all(files.map(async file => {
      const imagePath = file.path;
      const [result] = await client.textDetection(imagePath);
      const detections = result.textAnnotations;
      fs.unlinkSync(imagePath); // Poista väliaikainen tiedosto
      return detections.length > 0 ? detections[0].description : '';
    }));

    combinedText = texts.join(' ');
   

    console.log('OCR Combined Text:', combinedText);

    context = [{ role: 'user', content: combinedText }];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: context.concat([{ role: 'user', content: 'Luo yksi yksinkertainen ja selkeä koetehtävä ja sen vastaus yllä olevasta tekstistä suomeksi. Kysy vain yksi asia kerrallaan.' }]),
        max_tokens: 150
      })
    }); 

    const data = await response.json();

    console.log('API response:', JSON.stringify(data, null, 2));

    if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('No valid choices returned from API');
      } 

      const responseText = data.choices[0].message.content.trim();

      console.log('api vastaus:', responseText);

      const [question, answer] = responseText.includes('Vastaus:')
          ? responseText.split('Vastaus:')
          : [responseText, null]; 

 console.log('Parsed Question:', question);
 console.log('Parsed Answer:', answer);

 if (!question || !answer) {
  return res.status(400).json({ error: 'Model could not generate a valid question. Please provide a clearer text.' });
  }

  currentQuestion = question.trim(); // Päivitetään nykyinen kysymys
  correctAnswer = answer.trim();

  context.push({ role: 'assistant', content: `Kysymys: ${currentQuestion}` });
  context.push({ role: 'assistant', content: `Vastaus: ${correctAnswer}` });

  res.json({ question: currentQuestion, answer: correctAnswer });

} catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/check-answer', async (req, res) => {
  const userAnswer = req.body.user_answer;

  console.log('User answer:', userAnswer);
  console.log('Correct answer:', correctAnswer);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
      model: 'gpt-4',
      messages: [
      { role: 'system', content: 'Olet aina ystävällinen opettaja joka arvioi oppilaan vastauksen kohteliaaseen sävyyn.' },
      { role: 'user', content: `Kysymys: ${currentQuestion}` },
      { role: 'user', content: `Oikea vastaus: ${correctAnswer}` },
      { role: 'user', content: `Opiskelijan vastaus: ${userAnswer}` },
      { role: 'user', content: 'Arvioi opiskelijan vastaus asteikolla 0-10 ja anna lyhyt selitys ystävällisin ja kannustavin sanoin.' }
      ],
      max_tokens: 150
      })
      });

      const data = await response.json();

      const evaluation = data.choices[0].message.content.trim();
      console.log('Evaluation:', evaluation);

      res.json({ evaluation });
     
  } catch (error) {
   console.error('Virheviesti:', error.message);
   res.status(500).json({ error: 'Internal Server Error' });
  }
 });

 app.post('/next-question', async (req, res) => {

  try {
    const userResponse = req.body.user_response;
    context.push({ role: 'user', content: userResponse });

    // Generate the next question in Finnish using GPT-4o-mini
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: context.concat([{ role: 'user', content: 'Luo toinen yksinkertainen ja selkeä koetehtävä ja sen vastaus yllä olevasta tekstistä suomeksi. Kysy vain yksi asia kerrallaan.' }]),
        max_tokens: 150
      })
    }); 

    //vastaanota ja käsittele api vastaus json:ksi
    const data = await response.json();
    console.log('API response:', JSON.stringify(data, null, 2));

    if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('No valid choices returned from API');
    } 

    //Api vastauksen käsittely
    const responseText = data.choices[0].message.content.trim();
    console.log('Response Text:', responseText); 

     const [question, answer] = responseText.includes('Vastaus:')
      ? responseText.split('Vastaus:')
      : [responseText, null]; 

    console.log('Parsed Question:', question);
    console.log('Parsed Answer:', answer);

    if (!question || !answer) {
      return res.status(400).json({ error: 'Model could not generate a valid question. Please provide a clearer text.' });
    }

    currentQuestion = question.trim(); // Päivitetään nykyinen kysymys
    correctAnswer = answer.trim(); //päivitetään oikea vastaus

    // Update context eli Chat GPI keskustelu with the question and answer
    context.push({ role: 'assistant', content: `Kysymys: ${currentQuestion}` });
    context.push({ role: 'assistant', content: `Vastaus: ${correctAnswer}` });

    res.json({ question: currentQuestion, answer: correctAnswer }); 
     
  } catch (error) {
   console.error('Virheviesti:', error.message);
   res.status(500).json({ error: 'Internal Server Error' });
  }
 });

/* app.post('/chat', async (req, res) =>{

  const userMessage = req.body.message;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'user', content: userMessage }
        ],
        max_tokens: 150
      })
    });

    const data = await response.json();
    const reply = data.choices[0].message.content.trim();
    res.json({ reply });
    
  } catch (error) {
    console.error('Virheviesti:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }

})
 */




app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});