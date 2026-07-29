---
name: "web-design-guidelines"
description: "Review UI code for accessibility/UX/performance best practices. Invoke when asked to review UI, check accessibility, audit design/UX, or validate against guidelines."
---

# Web Interface Guidelines Review

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Fetch the latest guidelines from the source URL below
2. Read the specified files (or ask the user for files/pattern)
3. Check against all rules in the fetched guidelines
4. Output findings in the file:line format specified in the guidelines

## Guidelines Source

Fetch fresh guidelines before each review:

https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

## Usage

When a user provides a file or pattern argument:

- Fetch guidelines from the source URL above
- Read the specified files
- Apply all rules from the fetched guidelines
- Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
