/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License')
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const PROJECT_ID = 'cloud-functions-pa'          // Required - your Firebase project ID
const ALGOLIA_APP_ID = '3IS2RG3B27'     // Required - your Algolia app ID
const ALGOLIA_SEARCH_KEY = undefined // Optional - Only used for unauthenticated search
const HITS_PER_PAGE = 5
const ALGOLIA_INDEX = 'notes'
const TEST_USER_EMAIL= 'test@cloud-functions-pa.com'
const TEST_USER_PASSWORD = '123456789'
let securedAlgoliaSearchKey = undefined
const config = {
  apiKey: 'AIzaSyCmZ-PArMT21CiDcDxDe2onPGePzFIM5d8',
  authDomain: `${PROJECT_ID}.firebaseapp.com`,
  databaseURL: `https://${PROJECT_ID}.firebaseio.com`,
  projectId: PROJECT_ID
}

firebase.initializeApp(config)
firebase.firestore().settings({timestampsInSnapshots: true})

// Other code to wire up the buttons and textboxes.
document.querySelector('#do-add-note').addEventListener('click', function() {
  firebase.firestore().collection('notes').add({
    author: firebase.auth().currentUser.uid,
    text: document.querySelector('#note-text').value
  }).then(function() {
    document.querySelector('#note-text').value = ''
    console.log('Note created successfully!')
  }).catch(function(error) {
    console.log(error.message || error)
  })
})

document.querySelector('#do-query').addEventListener('click', function() {
  search(document.querySelector('#query-text').value)
    .then(function(hits) {
      document.querySelector('#results').innerHTML = ''
      
      hits.forEach(function(hit) {
        const nodeDOM = document.createElement('li')
        nodeDOM.innerHTML = hit._highlightResult.text.value
        document.querySelector('#results').append(nodeDOM)
      })
    })
    .catch(function(error) {
      document.querySelector('#results').innerHTML = error.message || error
    })
})

function search(query) {
  if (!PROJECT_ID) {
    console.warn('Please set PROJECT_ID in /index.js!')
  } else if (!ALGOLIA_APP_ID) {
    console.warn('Please set ALGOLIA_APP_ID in /index.js!')
  } else if (ALGOLIA_SEARCH_KEY) {
    console.log('Performing search unauthenticated...')

    return _searchUnauthenticated(query)       
  } else {
    console.log('Performing search authenticated...')

    return _searchAuthenticated(query)
  }
}

/**
 * Search on Algolia when user isn't authenticated
 * This function uses {ALGOLIA_SEARCH_KEY} variable settled above
 * 
 * @param {string} query - words to search on Algolia
 * @return {Promise.resolve}  the hits returned from Algolia
 */
function _searchUnauthenticated(query) {
  return _searchOnAlgolia(query, ALGOLIA_SEARCH_KEY)
}

/**
 * Search on Algolia when user is authenticated
 * This function retrieves a secured algolia search key from a google cloud function
 * 
 * @param {string} query - words to search on Algolia
 * @return {Promise.resolve}  the hits returned from Algolia
 */
function _searchAuthenticated(query) {  
  return _getSecuredAlgoliaSearchKey().then(function(algoliaToken) {
    return _searchOnAlgolia(query, algoliaToken).catch(function() {
      return _getSecuredAlgoliaSearchKey().then(function(refreshAlgoliaToken) {          
        return _searchOnAlgolia(query, refreshAlgoliaToken)
      })
    })
  })
}

/**
 * Retrieves the secured algolia search key saved in securedAlgoliaSearchKey variable
 * if it doesn't exist then fetch one using the {fetchSecuredSearchKey} function
 * 
 * @return {Promise.resolve} an algolia secured search key
 */
function _getSecuredAlgoliaSearchKey() {

  if (securedAlgoliaSearchKey) {
    return Promise.resolve(securedAlgoliaSearchKey)
  }

  return _getUserIdToken().then(function(userIdToken) {
    return _fetchSecuredSearchKey(userIdToken).then(function(token){
      securedAlgoliaSearchKey = token

      return securedAlgoliaSearchKey
    })
  }) 
}

/**
 * Retrieves id token of the current user authenticated if user isn't authenticated
 * then it authenticates to user and retrieves id token of him
 * 
 * @return {Promise.resolve}  id token of the user authenticated
 */
function _getUserIdToken() {
  if (!firebase.auth().currentUser) {
    return authenticate().then(function() {
      return _fetchUserIdToken()
    })
  }

  return _fetchUserIdToken()
}

/**
 * Fetches id token of the current user authenticated from Firebase
 * 
 * @return {Promise.resolve}  id token of the user authenticated
 */
function _fetchUserIdToken() {
  return firebase.auth().currentUser.getIdToken().catch(function() {
    console.log('Error trying to fetch user id token', error.message || error)

    return error
  })
}

/**
 * Authenticates to the testing user into using Firebase Auth using his email and password
 * 
 * @return {Promise.resolve} the user data
 */
function authenticate() {
  return firebase.auth()
    .signInWithEmailAndPassword(TEST_USER_EMAIL, TEST_USER_PASSWORD)
    .then(function(data) {
      console.log('User Authenticated successfully!')
      
      return data
    }).catch(function(error) {
      console.log('Error trying to authenticate to user: ', error.message || error)

      return error
    })
}

/**
 * Fetches an algolia search key from "getSearchKey" google cloud function
 * 
 * @param {string} userIdToken - JWT of the user authenticated
 * @return {Promise.resolve}  an algolia secured search key
 */
function _fetchSecuredSearchKey(userIdToken) {
   // The token is then passed to our getSearchKey Cloud Function
  return fetch(`https://us-central1-${PROJECT_ID}.cloudfunctions.net/getSearchKey`, {
    headers: { Authorization: 'Bearer ' + userIdToken }
  })
  .then(function(response) {
    return response.json()
  })
  .then(function(data) {    
    return data.key
  }).catch(function(error) {
    console.log('Error trying to fetch an algolia secured search token from "getSearchKey" google cloud function: ', error.message || error)

    return error
  })
}

/**
 * Search query on Algolia and fetches hits 
 * 
 * @param {string} query -  words to search on Algolia
 * @param {string} searchKey - Algolia search key
 * @return {Promise.resolve}  hits
 */
function _searchOnAlgolia(query, searchKey) {
  const client = algoliasearch(ALGOLIA_APP_ID, searchKey)
  const index = client.initIndex(ALGOLIA_INDEX)

  return index
    .search({
      query,
      hitsPerPage: HITS_PER_PAGE
    })
    .then(function(responses) {
      return responses.hits
    }).catch(function(error) {
      console.log('Error trying to search on Algolia: ', error.message || error)

      return error
    })
}

