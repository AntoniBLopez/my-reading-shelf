# PDF viewer zoom

The reader has two zooms. They must stay separate.

## Page zoom

This is the zoom of the page itself.

- Header + and − buttons (mobile and desktop)
- The percent field in the header
- Keyboard + and −

Changing it re-renders the page at that size and keeps the page centered. The header percent always shows this zoom. It is the default the reader returns to.

Defaults:

- Mobile: 110%.
- Desktop: 80%.
- Desktop fullscreen: 30%, only when the reader enters fullscreen and the page zoom is still that untouched 80%. If the reader changed the zoom first, fullscreen keeps their zoom. Leaving fullscreen restores 80% only if they never changed it. Mobile fullscreen stays at 110%.

## Finger zoom

This is the extra zoom from two fingers. It does not change the page zoom and does not change the header percent.

- Pinch open to zoom in, around the place between the fingers, not always the center of the page
- Drag with one finger to move in any direction while zoomed in
- Pinch closed to come back to the page zoom. At that point the page sits centered again and swiping to change pages works
- It cannot zoom out past the page zoom. To make the page itself smaller or larger, use the header or the keyboard

While finger zoom is above the page zoom, swiping must not turn the page.

Do not implement finger zoom by writing it into the page zoom. That recenters the page and makes the pinch behave like the header buttons.
