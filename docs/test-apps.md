# Test Apps

Three sample apps are included in `test/fixtures/` for testing ProofShot end-to-end. Each covers different UI patterns an AI coding agent might encounter.

## sample-app — SaaS Dashboard (port 5173)

A SaaS landing page with navigation, dashboard metrics, settings forms, and toggle switches.

```bash
cd test/fixtures/sample-app && npm install && npm run dev
```

**Test prompts:**

> Verify the homepage loads, navigate to the dashboard, confirm the status bar shows "All systems nominal", then go to settings and toggle off "Deploy notifications". Take a screenshot of each page.

> Navigate to the settings page, change the display name to "Grace Hopper", select the "Solarized" theme, toggle on "Weekend deploy alerts", and click Save Profile. Screenshot each step.

> Visit all three pages (home, dashboard, settings) and verify there are no console errors. On the dashboard, confirm the activity table has 5 rows. Screenshot the final state.

## todo-app — Kanban Board (port 5174)

A kanban board with drag-and-drop, right-click context menus, inline editing, keyboard shortcuts, and subtask checkboxes.

```bash
cd test/fixtures/todo-app && npm install && npm run dev
```

**Test prompts:**

> Open the kanban board. Drag the task "Fix bug that only happens on Fridays" from Backlog to In Progress. Then right-click on "Rewrite everything in Rust" and select "Archive". Create a new task called "Deploy v2.0" with priority P0 in the Backlog column. Screenshot the board after each action.

> Use the search bar to filter tasks containing "debug". Verify only matching cards are visible. Press Escape to clear the search. Then double-click the title of any task to rename it to "Ship it now". Screenshot the results.

> Press "n" to open the new task modal. Fill in title "Write migration script", set priority to P1 and label to "tech-debt", assign it to In Progress. Submit and verify the card appears. Then navigate to the archive page and confirm shipped task stats are displayed.

## chat-app — Messaging Interface (port 5175)

A messaging interface with channel switching, emoji picker, message reactions, file drag-and-drop, threaded replies, toast notifications, and collapsible accordions.

```bash
cd test/fixtures/chat-app && npm install && npm run dev
```

**Test prompts:**

> Open the chat app. Switch to the #incidents channel and read the messages. Click the reaction button on any message to add a thumbs-up. Then switch to #general, type "Deploying hotfix now" in the message input, and press Enter to send. Verify the toast notification appears. Screenshot each step.

> Click the emoji picker button, select an emoji, and verify it's inserted into the message input. Then click the file attach button and attach a file. Verify the attachment indicator appears. Toggle the markdown preview on and type "\*\*bold text\*\*" to confirm rendering. Screenshot the final state.

> Expand the threaded reply on a message in #general. Verify sub-messages are visible. Then navigate to the profile page, change the display name to "root", set status to DND, expand the "Appearance" accordion, and adjust the font size slider. Screenshot each interaction.

## Running Without an AI Agent

Each app includes a `test-proofshot.sh` script that runs the full ProofShot lifecycle without needing an AI agent:

```bash
cd test/fixtures/sample-app
bash test-proofshot.sh
```

This runs `start → browser interactions → stop → pr → clean` end-to-end.
