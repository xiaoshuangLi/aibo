---
name: macos-computer-control
description: Control a macOS computer through vision — take compressed screenshots, simulate mouse clicks, keyboard input, and scrolling to fulfil user goals autonomously.
---

# macOS Computer Control Skill

## 🎯 Purpose

This skill lets the agent **see and operate a macOS desktop** to complete any goal the user describes. It combines:

- **Vision**: full-screen compressed screenshots (≤300 KB JPEG) at logical screen resolution
- **Mouse control**: move cursor, left/right/middle click, double-click, scroll
- **Keyboard control**: type text character by character, press key combinations

## 🚀 When to Use

- The user asks you to "click", "open", "type into", "navigate", or otherwise operate the Mac desktop or any app
- You need to verify the current state of the screen before acting
- You need to automate a multi-step workflow (open app → fill form → submit)
- Any task that requires watching what happens on screen and reacting

## 🔧 Available Tools

| Tool | Purpose |
|------|---------|
| `macos_screenshot` | Capture the full screen as a compressed JPEG (≤300 KB) |
| `macos_get_screen_size` | Return logical screen width × height in pixels |
| `macos_mouse_move` | Move the cursor to (x, y) |
| `macos_mouse_click` | Click at (x, y) — left / right / middle, single or double |
| `macos_mouse_scroll` | Scroll up / down / left / right at (x, y) |
| `macos_keyboard_type` | Type a string as real keystrokes |
| `macos_key_press` | Press a key or key combination (e.g. "Command+C", "Enter") |

## 📋 Core Workflow

```
1. GET SCREEN STATE
   └─ macos_screenshot() → see what is currently on screen

2. IDENTIFY COORDINATES
   └─ examine the returned image carefully; read pixel positions directly

3. ACT
   ├─ macos_mouse_click(x, y)        — click a button / link
   ├─ macos_keyboard_type("text")    — fill a text field
   └─ macos_key_press("Command+C")   — keyboard shortcut

4. VERIFY
   └─ macos_screenshot() → confirm the expected result happened

5. REPEAT until goal is complete
```

## 🖼️ Screenshot & Coordinate Reading

### Full-screen capture (always)
```
macos_screenshot()
```

The screenshot is **always the full screen**, automatically resized to the logical screen resolution. This means:

> **image_x = screen_x** and **image_y = screen_y** — pixel coordinates in the image ARE the coordinates to pass to mouse tools. No conversion or scaling is needed.

### How to read coordinates from the screenshot

1. **Look at the full image** — it represents the entire screen at logical resolution.
2. **Locate the target element** (button, input field, link, icon, etc.) visually.
3. **Estimate its center pixel position** in the image — that is your `(x, y)`.
4. **Use those values directly** in `macos_mouse_click`, `macos_mouse_move`, etc.

> ⚠️ The coordinate note returned with each screenshot tells you the exact image dimensions (= screen dimensions). Use them as a sanity check: coordinates must be within `[0, width-1]` × `[0, height-1]`.

### Getting screen dimensions
```
macos_get_screen_size()   → { width: 1440, height: 900 }
```
The screenshot image will be exactly this size, so coordinates are directly comparable.

### Save to file (e.g. for debugging)
```
macos_screenshot({ save_path: "/tmp/screen.jpg" })
```

## 🖱️ Mouse Control Tips

### Single left-click (most common)
```
macos_mouse_click({ x: 450, y: 300 })
```

### Right-click (context menu)
```
macos_mouse_click({ x: 450, y: 300, button: "right" })
```

### Double-click (open file, select word)
```
macos_mouse_click({ x: 450, y: 300, double_click: true })
```

### Scroll in a list or web page
```
macos_mouse_scroll({ x: 640, y: 400, direction: "down", amount: 5 })
```

## ⌨️ Keyboard Control Tips

### Type text into the focused field
```
macos_keyboard_type({ text: "hello@example.com" })
```

### Common key combinations
| Action | Keys |
|--------|------|
| Copy | `Command+C` |
| Paste | `Command+V` |
| Cut | `Command+X` |
| Undo | `Command+Z` |
| Select All | `Command+A` |
| Save | `Command+S` |
| New Tab | `Command+T` |
| Close Tab/Window | `Command+W` |
| Quit App | `Command+Q` |
| Spotlight search | `Command+Space` |
| Screenshot (system) | `Command+Shift+3` |
| App Switcher | `Command+Tab` |
| Confirm / Submit | `Enter` |
| Cancel / Close | `Escape` |

```
macos_key_press({ keys: "Command+C" })
macos_key_press({ keys: "Enter" })
macos_key_press({ keys: "Command+Shift+4" })
```

## 🔄 Example: Open a URL in Safari

```
1. macos_key_press({ keys: "Command+Space" })           // Open Spotlight
2. macos_keyboard_type({ text: "Safari" })              // Type app name
3. macos_key_press({ keys: "Enter" })                   // Launch Safari
4. macos_screenshot()                                   // Verify Safari opened
5. macos_key_press({ keys: "Command+L" })               // Focus address bar
6. macos_keyboard_type({ text: "https://example.com" }) // Type URL
7. macos_key_press({ keys: "Enter" })                   // Navigate
8. macos_screenshot()                                   // Verify page loaded
```

## 🔄 Example: Click a Button by Location

```
1. macos_screenshot()
   → Image is 1440×900. Spot the "Submit" button at roughly x=760, y=540 in the image.
2. macos_mouse_click({ x: 760, y: 540 })   // Use image coords directly
3. macos_screenshot()                      // Confirm result
```

## 🔄 Example: Fill a Form

```
1. macos_screenshot()                                        // See form
2. macos_mouse_click({ x: 400, y: 200 })                     // Click first field
3. macos_keyboard_type({ text: "John Doe" })                  // Type name
4. macos_key_press({ keys: "Tab" })                          // Move to next field
5. macos_keyboard_type({ text: "john@example.com" })         // Type email
6. macos_mouse_click({ x: 400, y: 350 })                     // Click Submit
7. macos_screenshot()                                        // Verify submission
```

## ⚠️ Important Notes

- **macOS only**: All tools return an error on non-macOS platforms.
- **Permissions**: macOS requires Screen Recording and Accessibility permissions. Grant these to the Terminal / app running AIBO in System Settings → Privacy & Security.
- **Coordinate accuracy**: The screenshot is resized to logical screen resolution. Image pixel = screen coordinate — read positions directly from the image without any scaling. Take a new screenshot before each action to get fresh coordinates.
- **Cursor overlay**: The screenshot includes a visual arrow cursor showing where the mouse currently is. Use it to confirm your last click landed in the right place.
- **Timing**: If an action triggers an animation or loading, take a screenshot after a brief wait to ensure the UI has settled before the next action.

## 🚫 Anti-Patterns

| Anti-pattern | Why it fails | Correct approach |
|---|---|---|
| Acting without a screenshot | You may click the wrong place | Always screenshot first |
| Hardcoding coordinates | Screen layout changes | Re-screenshot each step |
| Applying a scale factor to image coordinates | The image is already at logical resolution — scaling creates errors | Use image pixel coords directly as screen coords |
| Typing without focusing the field | Keystrokes go nowhere | Click the field first |
| Not verifying after action | Silent failures go undetected | Screenshot after every action |
