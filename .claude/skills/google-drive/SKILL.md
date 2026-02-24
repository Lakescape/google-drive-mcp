---
name: google-drive
description: Use this skill when the user asks about Google Drive, Docs, Sheets, or Slides - creating, editing, formatting, searching, or managing files in Google Workspace.
---

# Google Drive MCP - Tool Usage Guide

This project has a built-in Google Drive MCP server providing 38 tools for managing Google Workspace files. All tools are available via MCP and prefixed with `mcp__google-drive__`.

## Quick Reference

### Drive Management
- `search` - Search files by query string. Returns file IDs, names, and MIME types.
- `listFolder` - List folder contents. Pass `folderId` or defaults to root. Supports `pageSize` and `pageToken` for pagination.
- `createFolder` - Create folder. `parent` accepts folder ID or path like `/Reports/2024`.
- `createTextFile` - Create `.txt` or `.md` files with content.
- `updateTextFile` - Update existing text file by `fileId`.
- `deleteItem` - Move item to trash (recoverable from Google Drive trash).
- `renameItem` - Rename file or folder by `itemId`.
- `moveItem` - Move file to different folder by `destinationFolderId`.

### Google Docs
- `createGoogleDoc` - Create new doc with `name` and `content`. Content is inserted as plain text.
- `updateGoogleDoc` - Replace all content in existing doc by `documentId`.
- `getGoogleDocContent` - Get doc content with text indices needed for formatting.
- `formatGoogleDocText` - Apply text formatting (bold, italic, underline, strikethrough, fontSize, foregroundColor) to a character range using `startIndex`/`endIndex` from getGoogleDocContent.
- `formatGoogleDocParagraph` - Apply paragraph styles (headings, alignment, line spacing) to a range.

### Google Sheets
- `createGoogleSheet` - Create spreadsheet with `data` as array of arrays (e.g., `[["Name","Age"],["Alice","30"]]`).
- `updateGoogleSheet` - Update cells by `spreadsheetId`, `range` (A1 notation like `Sheet1!A1:C10`), and `data`.
- `getGoogleSheetContent` - Read cells with formatting info.
- `formatGoogleSheetCells` - Set background color, alignment, wrap strategy.
- `formatGoogleSheetText` - Apply text formatting (bold, italic, font size, font family, color).
- `formatGoogleSheetNumbers` - Apply number formats (currency, percent, date patterns).
- `setGoogleSheetBorders` - Configure cell borders (style, width, color, which sides).
- `mergeGoogleSheetCells` - Merge cell ranges (MERGE_ALL, MERGE_COLUMNS, MERGE_ROWS).
- `addGoogleSheetConditionalFormat` - Add conditional formatting rules with conditions and format specs.

### Google Slides
- `createGoogleSlides` - Create presentation with `slides` array of `{title, content}` objects.
- `updateGoogleSlides` - Replace all slides in existing presentation.
- `getGoogleSlidesContent` - Get presentation structure with element/object IDs needed for formatting.
- `formatGoogleSlidesText` - Format text in slide elements by `objectId`.
- `formatGoogleSlidesParagraph` - Paragraph formatting with alignment and bullet styles.
- `styleGoogleSlidesShape` - Style shapes (fill color, outline color/weight/dash style).
- `setGoogleSlidesBackground` - Set background color for specific slides by `pageObjectIds`.
- `createGoogleSlidesTextBox` - Add text boxes with position (x, y in EMU), size, and text formatting.
- `createGoogleSlidesShape` - Add shapes (RECTANGLE, ELLIPSE, DIAMOND, TRIANGLE, STAR, etc.) with position and fill color.

## Important Patterns

### Always Get Content Before Formatting
For Docs and Slides, you must first get content to obtain the indices/IDs needed for formatting:
1. Call `getGoogleDocContent` to get text indices, then use those in `formatGoogleDocText`
2. Call `getGoogleSlidesContent` to get object IDs, then use those in formatting calls

### File IDs
All Google Workspace files are identified by their file ID (a string like `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`). Use `search` or `listFolder` to find IDs of existing files.

### Folder Paths
`createFolder` and file creation tools accept either:
- A folder ID (string): `1abc123def`
- A path (starts with /): `/Projects/Reports` - folders are created automatically if they don't exist

### Google Sheets Ranges
Use A1 notation for ranges: `Sheet1!A1:C10`, `A1:B5`, `Sheet1!A:A` (whole column)

### EMU Units for Slides
Positions and sizes in Slides use EMU (English Metric Units): 1 inch = 914400 EMU, 1 cm = 360000 EMU.
A typical slide is 10 inches wide (9144000 EMU) x 5.625 inches tall (5143500 EMU).

### Color Values
All color values use RGB/RGBA with values from 0 to 1 (not 0-255).
Example: `{ red: 0.2, green: 0.6, blue: 0.8 }` for a blue tone.
