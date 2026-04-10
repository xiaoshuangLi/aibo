---
name: macos-computer-control
description: Control a macOS computer through vision — take compressed screenshots, simulate mouse clicks, keyboard input, and scrolling to fulfil user goals autonomously.
---

# macOS Computer Control Skill

## 🎯 Purpose

This skill lets the agent **see and operate a macOS desktop** to complete any goal the user describes. It combines:

- **Vision**: compressed screenshots (≤300 KB JPEG) of the full screen or a specific region
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
| `macos_screenshot` | Capture full screen or a region as a compressed JPEG (≤300 KB) |
| `macos_get_screen_size` | Return screen width × height in pixels |
| `macos_mouse_move` | Move the cursor to (x, y) |
| `macos_mouse_click` | Click at (x, y) — left / right / middle, single or double |
| `macos_mouse_scroll` | Scroll up / down / left / right at (x, y) |
| `macos_keyboard_type` | Type a string as real keystrokes |
| `macos_key_press` | Press a key or key combination (e.g. "Command+C", "Enter") |

## 📋 Core Workflow

```
1. GET SCREEN STATE
   └─ macos_screenshot() → see what is currently on screen

2. PLAN the next action
   └─ identify target element and its approximate (x, y) coordinates

3. ACT
   ├─ macos_mouse_click(x, y)        — click a button / link
   ├─ macos_keyboard_type("text")    — fill a text field
   └─ macos_key_press("Command+C")   — keyboard shortcut

4. VERIFY
   └─ macos_screenshot() → confirm the expected result happened

5. REPEAT until goal is complete
```

## 🖼️ Screenshot Tips

### Full-screen capture (default)
```
macos_screenshot()
```

### Region capture — reduces token cost and focuses attention
```
macos_screenshot({
  region: { x: 100, y: 50, width: 800, height: 600 }
})
```

### Save to file (e.g. for debugging)
```
macos_screenshot({ save_path: "/tmp/screen.jpg" })
```

### Getting screen dimensions first
```
macos_get_screen_size()   → { width: 2560, height: 1600 }
```
Use the returned dimensions to calculate region coordinates or to understand the scale of the screen.

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
1. macos_screenshot()                              // See screen
2. Identify button at approximately (760, 540)
3. macos_mouse_click({ x: 760, y: 540 })           // Click it
4. macos_screenshot()                              // Confirm result
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
- **Retina displays**: Logical coordinates (what you pass to tools) are in CSS/logical pixels. On a Retina display the screenshot image will be at double the logical resolution. Use `macos_get_screen_size` to get logical dimensions.
- **Coordinate accuracy**: Always take a screenshot first and estimate coordinates from the image before clicking. Re-verify after clicking.
- **Timing**: If an action triggers an animation or loading, take a screenshot after a brief wait to ensure the UI has settled before the next action.
- **Region screenshots**: Prefer region screenshots to reduce image size and improve model focus on the relevant area.

## 🚫 Anti-Patterns

| Anti-pattern | Why it fails | Correct approach |
|---|---|---|
| Acting without a screenshot | You may click the wrong place | Always screenshot first |
| Hardcoding coordinates | Screen layout changes | Re-screenshot each step |
| Typing without focusing the field | Keystrokes go nowhere | Click the field first |
| Large full-screen screenshots for every step | Wastes tokens | Use region screenshots for follow-up steps |
| Not verifying after action | Silent failures go undetected | Screenshot after every action |
