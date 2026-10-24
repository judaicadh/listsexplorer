# Catalogue addition order

`data/lists.csv` has an optional `added_at` timestamp, distinct from the historical `date` of a list. Existing timestamps were recovered from the earliest Git commit containing each list ID. These are catalogue-history dates, not document dates or proof of when transcription began.

The standard importer assigns the current timestamp when importing a new list. Direct batch imports should likewise supply `added_at` for each new list. If a timestamp is missing, the directory uses CSV append order as a fallback; updating a transcription does not make it a new addition. Lists added in the same batch retain a deterministic reverse append order.

The Lists directory offers historical date ascending/descending, most recently added and alphabetical sorting. `?sort=recent` links directly to the newest additions. Filtering remains active when the order changes.
