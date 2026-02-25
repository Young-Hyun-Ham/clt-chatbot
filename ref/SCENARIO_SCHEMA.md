# Chatbot Scenario Schema v1.0

This document defines the structure of the JSON data used for chatbot scenarios.

**Last Updated:** 2025-10-31
**Current Version:** "1.2"

## Root Structure

The root object of a scenario JSON contains the following properties:

```json
{
  "version": "string",  // Schema version (e.g., "1.0") - MANDATORY
  "id": "string",       // Scenario ID (usually matches the document/file name)
  "name": "string",     // Scenario display name
  "job": "string",      // Scenario job type ("Batch", "Process", "Long Transaction")
  "description": "string | null", // Optional scenario description
  "nodes": [ ... ],     // Array of Node objects
  "edges": [ ... ],     // Array of Edge objects
  "startNodeId": "string | null" // ID of the node where the simulation should start
}
```

Node Object Structure Each node object has the following base structure:

```json
{
  "id": "string",         // Unique node ID
  "type": "string",       // Node type (e.g., "message", "form", "api", "delay")
  "position": {           // Position on the canvas
    "x": "number",
    "y": "number"
  },
  "data": { ... },        // Data specific to the node type
  "width": "number",        // Node width
  "height": "number",       // Node height
  "parentNode": "string | undefined", // ID of the parent node if grouped
  "extent": "'parent' | undefined"    // Usually 'parent' if grouped
}
```

Node Data Schemas (data object)

### message Node

```json
{
  "content": "string", // Text content of the message
  "replies": [         // Optional quick replies
    { "display": "string", "value": "string" },
    ...
  ],
  "chainNext": "boolean | undefined" // (Optional) If true, do not create a new bubble; append to the active bubble.
}
```

### form Node

```json
{
  "title": "string",   // Title displayed above the form
  "elements": [        // Array of form elements
    // See Form Element Schemas below
  ],
  "enableExcelUpload": "boolean | undefined" // (Optional) Whether to show the Excel upload button in the simulator
}
```

### api Node

```json
{
  "isMulti": "boolean", // Whether multiple API calls are enabled
  "chainNext": "boolean | undefined", // (Optional) If true, do not create a new bubble. (Note: Loading/Error still shows)
  // --- Single API Call Properties (used if isMulti is false) ---
  "method": "'GET' | 'POST' | 'PUT' | 'DELETE'",
  "url": "string",
  "headers": "string", // JSON string for headers
  "body": "string",    // JSON string for the request body
  "responseMapping": [
    { "path": "string", "slot": "string" }, // JSON path (e.g., data.items[0].id) and target slot name
    ...
  ],
  // --- Multi API Call Properties (used if isMulti is true) ---
  "apis": [
    {
      "id": "string", // Unique ID for this specific API call within the node
      "name": "string", // Display name for this API call
      "method": "'GET' | 'POST' | 'PUT' | 'DELETE'",
      "url": "string",
      "headers": "string",
      "body": "string",
      "responseMapping": [ ... ] // Same structure as above
    },
    ...
  ]
}
```

### branch Node

```json
{
  "content": "string", // Text displayed before options/conditions
  "evaluationType": "'BUTTON' | 'CONDITION'", // How to branch
  // --- Used if evaluationType is 'CONDITION' ---
  "conditions": [
    {
      "id": "string", // Unique ID for this condition (used for edge sourceHandle)
      "slot": "string", // Slot name to check
      "operator": "'==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | '!contains'",
      "value": "string", // Value to compare against
      "valueType": "'value' | 'slot'" // Whether 'value' is a literal or another slot name
    },
    ...
  ],
  // --- Used for button text (BUTTON) or condition handle mapping (CONDITION) ---
  "replies": [ // Array length must match conditions array length if CONDITION type
    { "display": "string", "value": "string" }, // 'value' is used for edge sourceHandle
    ...
  ]
}
```

### slotfilling Node

```json
{
  "content": "string", // Question asked to the user
  "slot": "string",    // Slot name to store the user's input/choice
  "replies": [         // Optional quick replies (if provided, input is chosen from these)
    { "display": "string", "value": "string" },
    ...
  ]
}
```

### setSlot Node

```json
{
  "assignments": [
    { "key": "string", "value": "string" }, // 'value' can be literal or "{slotName}"
    ... // Supports multiple assignments
  ],
  "chainNext": "boolean | undefined" // (Optional) If true, do not create a new bubble.
}
```

### delay Node

```json
{
  "duration": "number", // Delay duration in milliseconds (e.g., 1000 for 1 second)
  "chainNext": "boolean | undefined" // (Optional) If true, do not create a new bubble.
}
```

### fixedmenu Node

```json
{
  "content": "string", // Title or instruction for the fixed menu
  "replies": [         // Menu buttons
    { "display": "string", "value": "string" }, // 'value' is used for edge sourceHandle
    ...
  ]
}
```

### link Node

```json
{
  "content": "string", // URL of the link
  "display": "string",  // Text to display for the link
  "chainNext": "boolean | undefined" // (Optional) If true, do not create a new bubble.
}
```

### toast Node

```json
{
  "message": "string",      // Message content for the toast
  "toastType": "'info' | 'success' | 'error'", // Type of toast (affects appearance/icon)
  "chainNext": "boolean | undefined" // (Optional) If true, do not create a new bubble (toast still appears).
}
```

### iframe Node

```json
{
  "url": "string",       // URL to load in the iframe
  "width": "string",     // Width in pixels (e.g., "300")
  "height": "string",     // Height in pixels (e.g., "250")
  "chainNext": "boolean | undefined" // (Optional) If true, do not create a new bubble.
}
```

### scenario Node (Group Node)

```json
{
  "label": "string",       // Display name of the imported scenario
  "scenarioId": "string",  // ID of the imported scenario
  "isCollapsed": "boolean" // Whether the group node is currently collapsed
}
```

## Form Element Schemas (within form node data.elements)

### input Element

```json
{
  "id": "string",
  "type": "input",
  "name": "string",        // Slot name to store the value
  "label": "string",
  "placeholder": "string | undefined",
  "defaultValue": "string | undefined", // Default value (literal or "{slotName}")
  "validation": {
    "type": "'text' | 'email' | 'phone number' | 'custom'",
    "regex": "string | undefined" // Only if type is 'custom'
  }
}
```

### date Element

```json
{
  "id": "string",
  "type": "date",
  "name": "string",
  "label": "string",
  "defaultValue": "string | undefined", // e.g., "2025-12-31"
  "validation": { // Optional date range validation
    "type": "'today after' | 'today before' | 'custom'",
    "startDate": "string | undefined", // YYYY-MM-DD format, only if type is 'custom'
    "endDate": "string | undefined"    // YYYY-MM-DD format, only if type is 'custom'
  }
}
```

### grid Element

```json
{
  "id": "string",
  "type": "grid",
  "name": "string | undefined",         // Optional slot name (less common for display grids)
  "label": "string",
  "optionsSlot": "string | undefined", // Slot containing array data. Supports dot notation for nested paths (e.g., 'slotName.path.to.array'). NOTE: When linking to a 'search' element, only the root key (e.g., 'slotName') is used to match the 'search' element's 'resultSlot'.
  "displayKeys": "{ key: string, label: string }[] | undefined", // Array of objects defining columns. 'key' = data key, 'label' = header text.
  "hideNullColumns": "boolean | undefined", // Whether to hide columns if all values are null/empty
  // --- Fallback if optionsSlot is not used ---
  "rows": "number | undefined",
  "columns": "number | undefined",
  "data": "string[] | undefined"        // Flat array of cell values (row by row)
}
```

### checkbox Element

```json
{
  "id": "string",
  "type": "checkbox",
  "name": "string",        // Slot name to store the array of selected values
  "label": "string",
  "options": "string[]",   // Array of checkbox option labels/values
  "defaultValue": "string[] | undefined" // Array of initially checked values
}
```

### dropbox Element

```json
{
  "id": "string",
  "type": "dropbox",
  "name": "string",        // Slot name to store the selected value
  "label": "string",
  "optionsSlot": "string | undefined", // Slot containing array data (strings or {label, value} objects)
  "options": "(string | {label: string, value: string})[] | undefined", // Fallback options
  "defaultValue": "string | undefined" // Initially selected value
}
```

### search Element

```json
{
  "id": "string",
  "type": "search",
  "name": "string",        // Slot name to store the search term
  "label": "string",
  "placeholder": "string | undefined",
  "apiConfig": {
    "url": "string",
    "method": "'GET' | 'POST'",
    "headers": "string | undefined", // (Optional) JSON string for headers. Supports {slotName} interpolation.
    "bodyTemplate": "string | undefined" // (Optional) JSON string, used if method is 'POST'. '{{value}}' is replaced.
  },
  "inputFillKey": "string | null | undefined", // Key from the selected grid row data to fill the search input field. Defaults to the first column key.
  "resultSlot": "string" // Slot name to store the API response (e.g., an array for a grid)
}
```

## Edge Object Structure

```json
{
  "id": "string",             // Unique edge ID (often auto-generated)
  "source": "string",         // Source node ID
  "target": "string",         // Target node ID
  "sourceHandle": "string | null" // ID of the specific source handle (e.g., "onSuccess", reply value, condition ID, "default")
}
```
