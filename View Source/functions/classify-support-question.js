// An example of how to rank answers in a support database based on a user query
const lib = require('lib')({token: process.env.STDLIB_SECRET_TOKEN});
const cosineSimilarity = require( 'compute-cosine-similarity' );

let userQuery = context.params.query;

let googleSheetQuery = await lib.googlesheets.query['@0.3.2'].select({
  range: `A1:Z1000`,
  bounds: 'FIRST_EMPTY_ROW',
  where: [{}],
  limit: {
    'count': 0,
    'offset': 0
  }
});

// concatenate all of our required embeddings together
let embeddings = [];
let inputs = [userQuery].concat(
  googleSheetQuery.rows.map(row => row.fields.Question)
);

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

let userEmbedding = embeddings[0];

// Take the first item off of the embeddings list, it's the user query
// Then add embeddings into their appropriate question
embeddings = embeddings.slice(1);
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

return ranked;
