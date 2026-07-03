# ratpack

route planning overlay that allows multiple squadrats users to overlay their own progress onto the same map. This enables the everyone (the "ratpack" :P) to plan activities that maximise the haul of square of all!

## Implementation

This functionality is implemented as a web browser extension for Firefox. The official squadrats extension (https://addons.mozilla.org/en-US/firefox/addon/squadrats/) is proprietary ("All Rights Reserved"); ratpack is a clean-room reimplementation that reuses the functional concepts only — no code is copied from it. ratpack adds:

- the ability to add squadrats users within an extension modal window (the browser action popup)
- the user ID can be used as the input (see docs/squadrats)
- there is no cap on the number of users that can be added
- each user is assigned a random, distinct colour
- the colour of each user is editable after the user has been added, via a colour picker in the popup
- an optional display name (label) can be set per user via a text field in the popup; this is stored locally and is not fetched from the API (the squadrants endpoint has no name field)
- the colour used for squadrats (zoom 14) is always a lighter shade of the user's colour than the shade used for squadratinhos (zoom 17)
- depending on the number of added users that have collected a given squadrat:
  - zero users: tile is displayed as per the basemap
  - one user: tile is displayed with a colour overlay corresponding to that user and based on a (static constant) alpha value
  - 2+ users: tile is displayed with colours of each user striped diagonally from top left to bottom right. The sorting must be stable and based upon the user ID
