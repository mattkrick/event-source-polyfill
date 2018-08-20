# event-source-polyfill

EventSource polyfill for IE11 and Edge. Fully spec compliant: https://html.spec.whatwg.org/multipage/server-sent-events.html

## Why?

Because no other polyfill follows the spec.

## What's it do?

The __exact__ same thing that a minimum implementation of EventSource does. __No more, no less.__
For SSE that implements a heartbeat, see
https://github.com/mattkrick/trebuchet-client/

## Installation

`yarn add @mattkrick/event-source-polyfill @mattkrick/event-target-polyfill`

```js
import EventTargetPolyfill from '@mattkrick/event-target-polyfill'
import EventSourcePolyfill from '@mattkrick/event-source-polyfill'

window.EventTarget = EventTargetPolyfill
window.EventSource = EventSourcePolyfill
```

NOTE: Make sure your browser supports `EventTarget`! If it doesn't use that polyfill, too.


