import * as functions from 'firebase-functions'
import algoliasearch from 'algoliasearch'

export default functions.firestore
  .document('notes/{noteId}')
  .onCreate(onNoteCreated)

// Update the search index every time a blog post is written.
function onNoteCreated(snap, context) {
  const ALGOLIA_ID = functions.config().algolia.app_id
  const ALGOLIA_ADMIN_KEY = functions.config().algolia.api_key
  const ALGOLIA_INDEX_NAME = 'notes'

  const client = algoliasearch(ALGOLIA_ID, ALGOLIA_ADMIN_KEY)
  // Get the note document
  const note = snap.data()

  // Add an 'objectID' field which Algolia requires
  note.objectID = context.params.noteId

  // Write to the algolia index
  const index = client.initIndex(ALGOLIA_INDEX_NAME)
  return index.saveObject(note)
}
