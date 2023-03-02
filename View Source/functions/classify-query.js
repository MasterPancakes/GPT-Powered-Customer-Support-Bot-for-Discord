// An example of how to classify user queries as tech support or
// general conversation

const lib = require('lib')({token: process.env.STDLIB_SECRET_TOKEN});
const cosineSimilarity = require( 'compute-cosine-similarity' );

let userQuery = context.params.query;

let embeddingResult = await lib.openai.playground['@0.0.4'].embeddings.create({
  model: `text-embedding-ada-002`,
  input: [
    `technical support question`,
    `general conversation inquiry`,
    userQuery
  ]
});

let techEmbedding = embeddingResult.data[0].embedding;
let generalEmbedding = embeddingResult.data[1].embedding;
let userEmbedding = embeddingResult.data[2].embedding;

return generalEmbedding;

let category = cosineSimilarity(techEmbedding, userEmbedding)
  - cosineSimilarity(generalEmbedding, userEmbedding);

if (category > 0) {
  return {
    query: userQuery,
    category: `Tech support`
  };
} else {
  return {
    query: userQuery,
    category: `General conversation`
  };
}

