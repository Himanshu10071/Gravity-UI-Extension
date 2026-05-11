# Page Dropper (Gravity UI)

A Chrome extension that lets you click any page element and make it detach and fall with real physics (Matter.js). Elements are cloned into an overlay, the original is replaced by an invisible placeholder to keep layout stable, and the clone drops, collides, and stacks at the bottom of the page.

## Features

- Toggle with a keyboard shortcut (Ctrl+Shift+L by default)
- Hover highlight shows which element will fall
- Real physics via Matter.js (gravity, collision, stacking)
- Layout stays intact using invisible placeholders
- On-page toast when enabled/disabled

## How It Works

1. You press the shortcut to enable the extension.
2. Hovering shows a highlight around the element.
3. Clicking an element:
   - Reads its size/position via getBoundingClientRect().
   - Replaces the element with an invisible placeholder of identical size/margins.
   - Clones the element into a fixed overlay layer.
   - Creates a Matter.js body with matching dimensions.
   - Updates the clone position/rotation every animation frame.

## Install (Chrome)

1. Open Chrome and go to chrome://extensions
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select this project folder (the one containing manifest.json)

## Set the Shortcut

Chrome may leave the shortcut unassigned. To set it:

1. Go to chrome://extensions/shortcuts
2. Find "Page Dropper"
3. Set a shortcut for "Toggle Page Dropper" (Ctrl+Shift+L recommended)

## Usage

1. Press your shortcut to enable.
2. Hover an element to see the highlight.
3. Click to drop it.
4. Press the shortcut again to disable (dropped elements stay where they are).

## Notes / Limits

- Extensions cannot run on internal pages like chrome:// or the Chrome Web Store.
- Matter.js is bundled locally in matter.min.js (remote CDN code is blocked by Chrome extensions).

## Troubleshooting

- If nothing happens, check the shortcut is assigned in chrome://extensions/shortcuts.
- Open DevTools on the page to see logs in the Console.
- Open the extension service worker logs at chrome://extensions -> Service worker -> Inspect.

## Project Files

- manifest.json - Extension manifest
- background.js - Injects scripts and handles the shortcut
- content.js - Highlight, click handling, and physics sync
- content.css - Highlight + dropped styling
- matter.min.js - Matter.js physics engine
