import * as functions from 'firebase-functions'
import algoliasearch from 'algoliasearch'
import express from 'express'
import cors from 'cors'
import getFirebaseUser from '../middlewares/getFirebaseUser'

const app = express()
// We'll enable CORS support to allow the function to be invoked
// from our app client-side.
app.use(cors({ origin: true }))

// Then we'll also use a special 'getFirebaseUser' middleware which
// verifies the Authorization header and adds a `user` field to the
// incoming request:
// https://gist.github.com/abehaskins/832d6f8665454d0cd99ef08c229afb42
app.use(getFirebaseUser)

// Add a route handler to the app to generate the secured key
app.get('/', (req, res) => {
  // https://www.algolia.com/doc/api-client/javascript/getting-started/#install
  // App ID and API Key are stored in functions config variables
  const ALGOLIA_ID = functions.config().algolia.app_id
  const ALGOLIA_ADMIN_KEY = functions.config().algolia.api_key
  const ALGOLIA_SEARCH_KEY = functions.config().algolia.search_key
  const ALGOLIA_INDEX_NAME = 'notes'
  const client = algoliasearch(ALGOLIA_ID, ALGOLIA_ADMIN_KEY)
  // Create the params object as described in the Algolia documentation:
  // https://www.algolia.com/doc/guides/security/api-keys/#generating-api-keys

  console.log(req.user)

  const params = {
    // This filter ensures that only documents where author == user_id will be readable
    filters: `author:${req.user.user_id}`,
    //This parameter is used to restrict the query to only be valid for one or several indices.
    restrictIndices: ALGOLIA_INDEX_NAME,
    // We also proxy the user_id as a unique token for this key.
    userToken: req.user.user_id
  }

  // Call the Algolia API to generate a unique key based on our search key
  const key = client.generateSecuredApiKey(ALGOLIA_SEARCH_KEY, params)

  // Then return this key as {key: '...key'}
  res.json({ key })
})

// Finally, pass our ExpressJS app to Cloud Functions as a function
// called 'getSearchKey';
export default functions.https.onRequest(app)
