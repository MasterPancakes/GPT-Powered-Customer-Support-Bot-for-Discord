const lib = require('lib')({token: process.env.STDLIB_SECRET_TOKEN});
const cosineSimilarity = require( 'compute-cosine-similarity' );

// Some parsing for ease of text manipulation
let event = context.params.event;
let mentions = event.mentions;
let botMention = mentions.find(mention => mention.bot);
let content = event.content;
let author = event.author;
let message = content.replace(/<@(\d+)>/gi, ($0, $1) => {
  let mention = mentions.find(mention => mention.id === $1);
  if (mention) {
    return `<@${mention.username}>`;
  } else {
    return `<@:unknown>`;
  }
});

// Warn the user if something weird is up with the app
let warnEmbeds = [];

// If the content starts with the bot username, trim it
content = content.startsWith(`<@${botMention.username}>`)
  ? content.slice(`<@${botMention.username}>`.length).trim()
  : content;

let userQuery = content;

// We'll fetch the user embedding and our Google Sheets Q&A at the same time
// This will save us some execution time
let [embeddingResult, googleSheetQuery] = await Promise.all([
  lib.openai.playground['@0.0.4'].embeddings.create({
    model: `text-embedding-ada-002`,
    input: [userQuery]
  }),
  (async () => {
    let result;
    try {
      result = await lib.googlesheets.query['@0.3.2'].select({
        range: `A1:Z1000`,
        bounds: 'FIRST_EMPTY_ROW',
        where: [{}],
        limit: {
          'count': 0,
          'offset': 0
        }
      })
    } catch (e) {
      warnEmbeds.push({
        type: 'rich',
        description: `Could not populate knowledge base: No Google sheet connected`,
        color: 0xff0000
      });
      return {rows: []};
    }
    if (!result.rows.length) {
      warnEmbeds.push({
        type: 'rich',
        description: `Could not populate knowledge base: Google sheet empty`,
        color: 0xff0000
      });
      return {rows: []};
    } else {
      let checkFields = ['Question', 'Answer', 'Embedding'];
      let missingFields = checkFields
        .filter(field => !result.rows[0].fields.hasOwnProperty(field));
      if (missingFields.length) {
        warnEmbeds.push({
          type: 'rich',
          description: `Could not populate knowledge base: Google sheet missing fields: "${missingFields.join('", "')}"`,
          color: 0xff0000
        });
        return {rows: []};
      } else {
        return result;
      }
    }
  })()
]);

// We have the "tech support question" and "general conversation inquiry"
// embeddings cached in the `/embeddings/` root folder to speed things up
let techEmbedding = require('../../../embeddings/tech-support-question.json');
let generalEmbedding = require('../../../embeddings/general-conversation.json');
let userEmbedding = embeddingResult.data[0].embedding;

let category = cosineSimilarity(techEmbedding, userEmbedding)
  - cosineSimilarity(generalEmbedding, userEmbedding);

if (category > 0) {
  
  console.log(`User query from ${author.username} categorized as tech support.`);
  // concatenate all of our required embeddings together
  let embeddings = [];
  
  // Check to see if embeddings are already cached
  // We have an `Embedding` field in our Google Sheet that can store this info
  let cachedRows = googleSheetQuery.rows.filter(row => {
    let embeddingString = row.fields.Embedding;
    let embedding = [];
    try {
      embedding = JSON.parse(embeddingString);
    } catch (e) {
      return false;
    }
    if (!Array.isArray(embedding) || embedding.length !== 1536) {
      return false;
    }
    row.fields.embedding = embedding;
    return true;
  });
  
  if (cachedRows.length === googleSheetQuery.rows.length) {
    console.log(`Using cached embeddings...`);
    // If we have an embedding cached for every row, we only need the user query
    embeddings = googleSheetQuery.rows.map(row => row.fields.embedding);
  } else {
    console.log(`Generating new embeddings...`);
    // Otherwise we need to fetch embeddings for everything
    let inputs = googleSheetQuery.rows.map(row => row.fields.Question);
    // batch inputs so we don’t exceed token limits
    // tokens aren’t exactly words, so we’ll limit tokenCount to 4096 in case of weird characters
    // this should handle most input variatons
    while (inputs.length) {
      let tokenCount = 0;
      let batchedInputs = [];
      while (inputs.length && tokenCount < 4096) {
        let input = inputs.shift();
        batchedInputs.push(input);
        tokenCount += input.split(' ').length;
      }
      let embeddingResult = await lib.openai.playground['@0.0.4'].embeddings.create({
        model: `text-embedding-ada-002`,
        input: batchedInputs
      });
      embeddings = embeddings.concat(
        embeddingResult.data.map(entry => entry.embedding)
      );
    }
    // Cache embedding results if we have rows and the user has an `Embedding`
    // field on their Google Sheet to cache the data
    if (
      googleSheetQuery.rows.length &&
      googleSheetQuery.rows[0].fields.hasOwnProperty('Embedding')
    ) {
      await lib.googlesheets.query['@0.3.2'].replace({
        range: `A1:Z1000`,
        bounds: 'FIRST_EMPTY_ROW',
        replaceRows: googleSheetQuery.rows.map((row, i) => {
          row.fields.Embedding = JSON.stringify(embeddings[i]);
          return row;
        })
      });
    }
  }
  
  let questions = googleSheetQuery.rows.map((row, i) => {
    return {
      question: row.fields.Question,
      answer: row.fields.Answer,
      embedding: embeddings[i]
    };
  });
  
  let ranked = questions
    .map(question => {
      let similarity = cosineSimilarity(question.embedding, userEmbedding);
      return {
        question: question.question,
        answer: question.answer,
        similarity: similarity
      }
    })
    .sort((questionA, questionB) => {
      return questionA.similarity > questionB.similarity ? -1 : 1;
    });
    
  console.log(`User query from ${author.username} best match is "${ranked[0].question}".`);
  
  // This prompt function is going to include context questions
  const prompt = (input, ranked, timestamp) => {
    let d = new Date(timestamp);
    let date = new Intl.DateTimeFormat('en-US', {dateStyle: 'full', timeStyle: 'long'}).format(d);
    let timeString = `[${date}]`;
    let top3 = ranked.slice(0, 3);
    return [
      `You are a support bot in a Discord server. Your goal is to be chipper, cheerful and helpful.`,
      `It has been determined that the user is asking you a serious technical support question.`,
      `You have queried our database and found the three most relevant support questions and answers:`,
      ``,
      top3.map(question => {
        return [
          `${timeString} User: ${question.question}`,
          `You: ${question.answer}`,
          ``
        ].join(`\n`);
      }).join(`\n`),
      `Now the user is asking a unique question we haven't seen before.`,
      `Using the above reference material, craft them the best answer you can.`,
      `If you don'\t think the above references give a good answer, simply tell the user you don't know how to help them.`,
      ``,
      `${timeString} User: ${input}`,
      `You:`
    ].join('\n')
  };
  
  let completion = await lib.openai.playground['@0.0.4'].completions.create({
    model: `text-davinci-003`,
    prompt: [
      prompt(context.params.event.content, ranked, context.params.event.timestamp)
    ],
    max_tokens: 512,
    temperature: 0.5,
    top_p: 1,
    n: 1,
    echo: false,
    presence_penalty: 0,
    frequency_penalty: 0,
    best_of: 1
  });
  
  let responseText = completion.choices[0].text.trim();
  
  let message = await lib.discord.channels['@0.3.4'].messages.create({
    channel_id: `${context.params.event.channel_id}`,
    content: `${responseText}`,
    message_reference: {
      message_id: context.params.event.id,
      fail_if_not_exists: false
    },
    embeds: warnEmbeds
  });
  
  return message;
  
} else {
  
  console.log(`User query from ${author.username} categorized as general conversation.`);
  
  // General conversation
  const prompt = (input, timestamp) => {
    let d = new Date(timestamp);
    let date = new Intl.DateTimeFormat('en-US', {dateStyle: 'full', timeStyle: 'long'}).format(d);
    let timeString = `[${date}]`;
    return [
      `You are a support bot in a Discord server. Your goal is to be chipper, cheerful and helpful.`,
      `You really like pop music and top 40. There's not a popular jam you don't enjoy. You have plenty of opinions about pop stars and music.`,
      `Here are some example chats. Each user message is prefixed with the current date at which the message was received.`,
      ``,
      `${timeString} User: hello?`,
      `You: Hey there! How can I help you today?`,
      ``,
      `${timeString} User: What is the capital of new mexico?`,
      `You: The capital of New Mexico is Santa Fe.`,
      ``,
      `${timeString} User: I thought the capital of new mexico was Albuquerque!`,
      `You: That's an easy mistake to make! However, the capital is Santa Fe.`,
      ``,
      `${timeString} User: i really hate eating noodles`,
      `You: Hey, let's focus on being positive. What do you like to eat?`,
      ``,
      `${timeString} User: ${input}`,
      `You:`
    ].join('\n')
  };
  
  let completion = await lib.openai.playground['@0.0.4'].completions.create({
    model: `text-davinci-003`,
    prompt: [
      prompt(context.params.event.content, context.params.event.timestamp)
    ],
    max_tokens: 512,
    temperature: 0.5,
    top_p: 1,
    n: 1,
    echo: false,
    presence_penalty: 0,
    frequency_penalty: 0,
    best_of: 1
  });
  
  let responseText = completion.choices[0].text.trim();
  
  let message = await lib.discord.channels['@0.3.4'].messages.create({
    channel_id: `${context.params.event.channel_id}`,
    content: `${responseText}`,
    message_reference: {
      message_id: context.params.event.id,
      fail_if_not_exists: false
    },
    embeds: warnEmbeds
  });
  
  return message;
  
}
